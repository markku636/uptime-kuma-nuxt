// server/services/monitor-distributor.ts
// Monitor distribution service for SealWatch cluster mode
// Handles node assignment for monitors based on capacity and load balancing

import { prisma } from '../utils/prisma'
import { clusterConfig, isClusterMode, getCurrentNodeId } from '../utils/cluster-config'
import type { NodeCapacity, IMonitorDistributor } from '~~/types/cluster'

// Cache for setup complete status
let setupCompleteCache: boolean | null = null
let setupCompleteCacheTime = 0
const SETUP_CACHE_TTL = 5000 // 5 seconds

// Round-robin index for node selection
let roundRobinIndex = 0

/**
 * Monitor Distributor Service
 */
class MonitorDistributor implements IMonitorDistributor {
  /**
   * Check if initial setup is complete (has at least one user)
   */
  async isSetupComplete(): Promise<boolean> {
    const now = Date.now()

    // Check cache
    if (setupCompleteCache !== null && now - setupCompleteCacheTime < SETUP_CACHE_TTL) {
      return setupCompleteCache
    }

    // Query database
    const userCount = await prisma.user.count()
    setupCompleteCache = userCount > 0
    setupCompleteCacheTime = now

    return setupCompleteCache
  }

  /**
   * Get the effective node for a monitor
   * Priority: assigned_node > node_id > fallback to hash
   */
  async getNodeForMonitor(monitorId: number): Promise<string> {
    // If not in cluster mode, return current node
    if (!isClusterMode()) {
      return getCurrentNodeId()
    }

    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
      select: {
        assignedNode: true,
        nodeId: true,
      },
    })

    if (!monitor) {
      // Monitor not found, use hash routing as fallback
      return this.hashRoute(monitorId)
    }

    // Priority: assigned_node (override) > node_id (default)
    const effectiveNode = monitor.assignedNode || monitor.nodeId

    if (effectiveNode) {
      // Verify node is online
      const node = await prisma.node.findUnique({
        where: { nodeId: effectiveNode },
        select: { status: true },
      })

      if (node && node.status === 'online') {
        return effectiveNode
      }

      // Node is offline, fall back to finding an available node
      const availableNode = await this.findAvailableNode()
      return availableNode || this.hashRoute(monitorId)
    }

    // No node assigned, use hash routing
    return this.hashRoute(monitorId)
  }

  /**
   * Assign a node to a new monitor based on capacity
   * Selects the node with the lowest monitor count
   */
  async assignNodeToMonitor(monitorId: number): Promise<string> {
    // If not in cluster mode, use current node
    if (!isClusterMode()) {
      const currentNode = getCurrentNodeId()
      await prisma.monitor.update({
        where: { id: monitorId },
        data: { nodeId: currentNode },
      })
      return currentNode
    }

    // Find the node with lowest load
    const selectedNode = await this.findAvailableNode()

    if (!selectedNode) {
      // All nodes at capacity, use round-robin
      const node = await this.selectNodeRoundRobin()
      await prisma.monitor.update({
        where: { id: monitorId },
        data: { nodeId: node },
      })
      return node
    }

    // Assign monitor to selected node
    await prisma.monitor.update({
      where: { id: monitorId },
      data: { nodeId: selectedNode },
    })

    console.log(`[MonitorDistributor] Assigned monitor ${monitorId} to node ${selectedNode}`)
    return selectedNode
  }

  /**
   * Get monitor count for a specific node
   */
  async getMonitorCountByNode(nodeId: string): Promise<number> {
    const count = await prisma.monitor.count({
      where: {
        active: true,
        OR: [
          { assignedNode: nodeId },
          { assignedNode: null, nodeId: nodeId },
        ],
      },
    })

    return count
  }

  /**
   * Rebalance monitors across all nodes
   * Redistributes monitors from overloaded nodes to underloaded ones
   */
  async rebalanceMonitors(): Promise<void> {
    if (!isClusterMode()) {
      console.log('[MonitorDistributor] Not in cluster mode, skipping rebalance')
      return
    }

    console.log('[MonitorDistributor] Starting monitor rebalance...')

    // Get capacity info for all nodes
    const capacities = await this.getClusterCapacity()
    const onlineNodes = capacities.filter((n) => n.status === 'online')

    if (onlineNodes.length === 0) {
      console.warn('[MonitorDistributor] No online nodes, cannot rebalance')
      return
    }

    // Calculate average load
    const totalMonitors = onlineNodes.reduce((sum, n) => sum + n.currentCount, 0)
    const avgPerNode = Math.ceil(totalMonitors / onlineNodes.length)

    console.log(`[MonitorDistributor] Total monitors: ${totalMonitors}, Avg per node: ${avgPerNode}`)

    // Find overloaded and underloaded nodes
    const overloaded = onlineNodes.filter((n) => n.currentCount > avgPerNode + 1)
    const underloaded = onlineNodes.filter((n) => n.currentCount < avgPerNode - 1)

    if (overloaded.length === 0 || underloaded.length === 0) {
      console.log('[MonitorDistributor] Cluster is balanced, no rebalance needed')
      return
    }

    // Move monitors from overloaded to underloaded nodes
    for (const sourceNode of overloaded) {
      const excessCount = sourceNode.currentCount - avgPerNode

      // Get monitors to move (prefer ones without manual assignment)
      const monitorsToMove = await prisma.monitor.findMany({
        where: {
          nodeId: sourceNode.nodeId,
          assignedNode: null, // Only move monitors without override
          active: true,
        },
        select: { id: true },
        take: excessCount,
      })

      if (monitorsToMove.length === 0) continue

      // Distribute to underloaded nodes
      let targetIndex = 0
      for (const monitor of monitorsToMove) {
        const targetNode = underloaded[targetIndex % underloaded.length]

        await prisma.monitor.update({
          where: { id: monitor.id },
          data: { nodeId: targetNode.nodeId },
        })

        console.log(`[MonitorDistributor] Moved monitor ${monitor.id} from ${sourceNode.nodeId} to ${targetNode.nodeId}`)
        targetIndex++
      }
    }

    console.log('[MonitorDistributor] Rebalance complete')
  }

  /**
   * Find an available node with capacity
   * Returns the node with lowest monitor count under the limit
   */
  async findAvailableNode(): Promise<string | null> {
    // Get online nodes with their monitor counts
    const nodesWithCounts = await prisma.$queryRaw<Array<{ nodeId: string; monitorCount: bigint }>>`
      SELECT 
        n.node_id as "nodeId",
        COUNT(m.id) as "monitorCount"
      FROM nodes n
      LEFT JOIN monitors m ON (m.node_id = n.node_id OR m.assigned_node = n.node_id) AND m.active = true
      WHERE n.status = 'online' AND n.active = true
      GROUP BY n.node_id
      HAVING COUNT(m.id) < ${clusterConfig.monitorLimitPerNode}
      ORDER BY COUNT(m.id) ASC
      LIMIT 1
    `

    if (nodesWithCounts.length === 0) {
      console.warn('[MonitorDistributor] No available node found, all at capacity')
      return null
    }

    return nodesWithCounts[0].nodeId
  }

  /**
   * Get cluster capacity summary
   */
  async getClusterCapacity(): Promise<NodeCapacity[]> {
    const nodes = await prisma.node.findMany({
      where: { active: true },
      orderBy: { nodeId: 'asc' },
    })

    const capacities: NodeCapacity[] = []

    for (const node of nodes) {
      const count = await this.getMonitorCountByNode(node.nodeId)
      const usagePercent = (count / clusterConfig.monitorLimitPerNode) * 100

      capacities.push({
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        status: node.status as 'online' | 'offline' | 'unknown',
        currentCount: count,
        limitPerNode: clusterConfig.monitorLimitPerNode,
        usagePercent: Math.round(usagePercent * 100) / 100,
        lastSeen: node.lastSeen,
      })
    }

    return capacities
  }

  /**
   * Hash-based routing as fallback
   */
  private hashRoute(monitorId: number): string {
    const nodeIndex = (monitorId % clusterConfig.nodeCount) + 1
    return `node${nodeIndex}`
  }

  /**
   * Round-robin node selection
   */
  private async selectNodeRoundRobin(): Promise<string> {
    const nodes = await prisma.node.findMany({
      where: { active: true, status: 'online' },
      select: { nodeId: true },
      orderBy: { nodeId: 'asc' },
    })

    if (nodes.length === 0) {
      return clusterConfig.defaultNode
    }

    const selectedNode = nodes[roundRobinIndex % nodes.length]
    roundRobinIndex = (roundRobinIndex + 1) % nodes.length

    return selectedNode.nodeId
  }
}

// Singleton instance
export const monitorDistributor = new MonitorDistributor()

/**
 * Get effective node for a monitor (convenience function)
 */
export async function getNodeForMonitor(monitorId: number): Promise<string> {
  return monitorDistributor.getNodeForMonitor(monitorId)
}

/**
 * Assign node to new monitor (convenience function)
 */
export async function assignNodeToMonitor(monitorId: number): Promise<string> {
  return monitorDistributor.assignNodeToMonitor(monitorId)
}

/**
 * Check if setup is complete (convenience function)
 */
export async function isSetupComplete(): Promise<boolean> {
  return monitorDistributor.isSetupComplete()
}

export default monitorDistributor

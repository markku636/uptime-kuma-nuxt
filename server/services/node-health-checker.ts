// server/services/node-health-checker.ts
// Node health check service for SealWatch cluster mode
// Periodically checks node health and redistributes monitors on failure

import { prisma } from '../utils/prisma'
import {
  clusterConfig,
  isClusterMode,
  getHealthCheckUrl,
  getCurrentNodeId,
} from '../utils/cluster-config'
import type {
  NodeInfo,
  NodeStatus,
  HealthCheckResult,
  MonitorRedistribution,
  INodeHealthChecker,
} from '~~/types/cluster'

// Track consecutive failures/successes per node
const nodeFailures = new Map<string, number>()
const nodeSuccesses = new Map<string, number>()

// Health check timer
let healthCheckTimer: NodeJS.Timeout | null = null

// Flag to track if this node is the primary checker
let isPrimaryChecker = false

/**
 * Node Health Checker Service
 */
class NodeHealthChecker implements INodeHealthChecker {
  private isRunning = false

  /**
   * Start periodic health checks
   * Only one node in the cluster should run health checks (typically the primary)
   */
  async start(): Promise<void> {
    if (!isClusterMode()) {
      console.log('[NodeHealth] Not in cluster mode, skipping health checks')
      return
    }

    if (this.isRunning) {
      console.log('[NodeHealth] Already running')
      return
    }

    // Determine if this node should be the primary checker
    const currentNodeId = getCurrentNodeId()
    const primaryNode = await this.getPrimaryNode()

    if (primaryNode && primaryNode.nodeId !== currentNodeId) {
      console.log(`[NodeHealth] Not primary node (${currentNodeId}), skipping health checker start`)
      return
    }

    isPrimaryChecker = true
    this.isRunning = true
    console.log(`[NodeHealth] Starting health checks (interval: ${clusterConfig.healthCheckInterval}s)`)

    // Run initial check
    await this.runHealthChecks()

    // Schedule periodic checks
    healthCheckTimer = setInterval(
      () => this.runHealthChecks(),
      clusterConfig.healthCheckInterval * 1000
    )
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer)
      healthCheckTimer = null
    }
    this.isRunning = false
    isPrimaryChecker = false
    nodeFailures.clear()
    nodeSuccesses.clear()
    console.log('[NodeHealth] Stopped health checks')
  }

  /**
   * Get the primary node from database
   */
  private async getPrimaryNode(): Promise<NodeInfo | null> {
    const node = await prisma.node.findFirst({
      where: { isPrimary: true, active: true },
    })
    return node as NodeInfo | null
  }

  /**
   * Run health checks on all nodes
   */
  private async runHealthChecks(): Promise<void> {
    const currentNodeId = getCurrentNodeId()

    try {
      const nodes = await this.getAllNodes()
      console.log(`[NodeHealth] Checking ${nodes.length} nodes...`)

      for (const node of nodes) {
        // Skip self-check
        if (node.nodeId === currentNodeId) {
          continue
        }

        const result = await this.checkNodeHealth(node.nodeId)

        if (result.isHealthy) {
          await this.handleHealthyNode(node)
        } else {
          await this.handleUnhealthyNode(node, result.lastError)
        }
      }
    } catch (error) {
      console.error('[NodeHealth] Error during health checks:', error)
    }
  }

  /**
   * Handle a healthy node response
   */
  private async handleHealthyNode(node: NodeInfo): Promise<void> {
    // Reset failure counter
    nodeFailures.set(node.nodeId, 0)

    // Increment success counter
    const successCount = (nodeSuccesses.get(node.nodeId) || 0) + 1
    nodeSuccesses.set(node.nodeId, successCount)

    // If node was offline and now has enough consecutive successes, bring it back online
    if (node.status === 'offline' && successCount >= clusterConfig.consecutiveSuccessThreshold) {
      console.log(`[NodeHealth] Node ${node.nodeId} recovered after ${successCount} successful checks`)

      await this.updateNodeStatus(node.nodeId, 'online')

      // Revert monitors back to this node
      const revertedCount = await this.revertMonitors(node.nodeId)
      console.log(`[NodeHealth] Reverted ${revertedCount} monitors back to node ${node.nodeId}`)

      nodeSuccesses.set(node.nodeId, 0)
    } else if (node.status !== 'online') {
      // Update to online if not already
      await this.updateNodeStatus(node.nodeId, 'online')
    }
  }

  /**
   * Handle an unhealthy node response
   */
  private async handleUnhealthyNode(node: NodeInfo, error: string | null): Promise<void> {
    // Reset success counter
    nodeSuccesses.set(node.nodeId, 0)

    // Increment failure counter
    const failCount = (nodeFailures.get(node.nodeId) || 0) + 1
    nodeFailures.set(node.nodeId, failCount)

    console.log(`[NodeHealth] Node ${node.nodeId} failed check (${failCount}/${clusterConfig.consecutiveFailuresThreshold})`)

    // If enough consecutive failures, mark as offline and redistribute
    if (failCount >= clusterConfig.consecutiveFailuresThreshold && node.status !== 'offline') {
      console.log(`[NodeHealth] Node ${node.nodeId} marked as OFFLINE after ${failCount} failures`)

      await this.updateNodeStatus(node.nodeId, 'offline', error || 'Health check failed')

      // Redistribute monitors from failed node
      const redistribution = await this.redistributeMonitors(node.nodeId)
      if (redistribution) {
        console.log(`[NodeHealth] Redistributed ${redistribution.affectedCount} monitors from ${node.nodeId}`)
      }

      nodeFailures.set(node.nodeId, 0)
    }
  }

  /**
   * Check health of a single node
   */
  async checkNodeHealth(nodeId: string): Promise<HealthCheckResult> {
    const node = await prisma.node.findUnique({
      where: { nodeId },
    })

    if (!node) {
      return {
        nodeId,
        isHealthy: false,
        responseTime: 0,
        lastError: 'Node not found in database',
        checkedAt: new Date(),
      }
    }

    const host = node.host || `${clusterConfig.nodeHostPrefix}${nodeId}:${clusterConfig.defaultPort}`
    const url = getHealthCheckUrl(host)

    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        clusterConfig.healthCheckTimeout
      )

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const responseTime = Date.now() - startTime

      if (response.ok) {
        return {
          nodeId,
          isHealthy: true,
          responseTime,
          lastError: null,
          checkedAt: new Date(),
          httpStatus: response.status,
        }
      }

      return {
        nodeId,
        isHealthy: false,
        responseTime,
        lastError: `HTTP ${response.status}: ${response.statusText}`,
        checkedAt: new Date(),
        httpStatus: response.status,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      return {
        nodeId,
        isHealthy: false,
        responseTime,
        lastError: errorMessage,
        checkedAt: new Date(),
      }
    }
  }

  /**
   * Update node status in database
   */
  async updateNodeStatus(nodeId: string, status: NodeStatus, error?: string): Promise<void> {
    await prisma.node.update({
      where: { nodeId },
      data: {
        status,
        lastSeen: status === 'online' ? new Date() : undefined,
        lastError: error || null,
      },
    })

    console.log(`[NodeHealth] Updated node ${nodeId} status to ${status}`)
  }

  /**
   * Redistribute monitors from a failed node to other online nodes
   */
  async redistributeMonitors(failedNodeId: string): Promise<MonitorRedistribution | null> {
    console.log(`[NodeHealth] Starting redistribution from node ${failedNodeId}`)

    // Get online nodes (excluding failed node)
    const targetNodes = await this.getOnlineNodesExcept(failedNodeId)

    if (targetNodes.length === 0) {
      console.warn(`[NodeHealth] No online nodes available for redistribution from ${failedNodeId}`)
      return null
    }

    // Get monitors that need redistribution using raw SQL
    // Monitors where assigned_node = failedNodeId OR (assigned_node IS NULL AND node_id = failedNodeId)
    const monitors = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM monitors 
      WHERE assigned_node = ${failedNodeId} 
         OR (assigned_node IS NULL AND node_id = ${failedNodeId})
      ORDER BY id
    `

    if (monitors.length === 0) {
      console.log(`[NodeHealth] No monitors to redistribute from node ${failedNodeId}`)
      return null
    }

    // Round-robin distribution to target nodes
    const targetNodeIds = targetNodes.map((n) => n.nodeId)
    const affectedMonitorIds: number[] = []

    for (let i = 0; i < monitors.length; i++) {
      const monitor = monitors[i]
      const targetNodeId = targetNodeIds[i % targetNodeIds.length]

      await prisma.$executeRaw`
        UPDATE monitors SET assigned_node = ${targetNodeId} WHERE id = ${monitor.id}
      `

      affectedMonitorIds.push(monitor.id)
    }

    console.log(`[NodeHealth] Redistributed ${affectedMonitorIds.length} monitors from ${failedNodeId} to ${targetNodeIds.length} nodes`)

    return {
      sourceNode: failedNodeId,
      targetNodes: targetNodeIds,
      monitorIds: affectedMonitorIds,
      affectedCount: affectedMonitorIds.length,
      timestamp: new Date(),
    }
  }

  /**
   * Revert monitors back to their original node when it recovers
   * Clears the assigned_node field for monitors that were temporarily reassigned
   */
  async revertMonitors(nodeId: string): Promise<number> {
    console.log(`[NodeHealth] Reverting monitors for recovered node ${nodeId}`)

    // Clear assigned_node for monitors whose original node_id matches the recovered node
    const result = await prisma.$executeRaw`
      UPDATE monitors SET assigned_node = NULL 
      WHERE node_id = ${nodeId} AND assigned_node IS NOT NULL
    `

    console.log(`[NodeHealth] Reverted ${result} monitors to node ${nodeId}`)
    return Number(result)
  }

  /**
   * Get all active nodes from database
   */
  async getAllNodes(): Promise<NodeInfo[]> {
    const nodes = await prisma.node.findMany({
      where: { active: true },
      orderBy: { nodeId: 'asc' },
    })

    return nodes as NodeInfo[]
  }

  /**
   * Get online nodes excluding specified node
   */
  async getOnlineNodesExcept(excludeNodeId: string): Promise<NodeInfo[]> {
    const nodes = await prisma.node.findMany({
      where: {
        active: true,
        status: 'online',
        nodeId: { not: excludeNodeId },
      },
      orderBy: { nodeId: 'asc' },
    })

    return nodes as NodeInfo[]
  }
}

// Singleton instance
export const nodeHealthChecker = new NodeHealthChecker()

/**
 * Initialize node health checker
 * Called from server plugin
 */
export async function initializeNodeHealthChecker(): Promise<void> {
  await nodeHealthChecker.start()
}

/**
 * Stop node health checker
 * Called on shutdown
 */
export function stopNodeHealthChecker(): void {
  nodeHealthChecker.stop()
}

export default nodeHealthChecker

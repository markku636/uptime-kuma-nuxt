// server/services/dynamic-node-discovery.ts
// Dynamic node discovery service for SealWatch cluster mode
// Supports database-based discovery and K8s headless service DNS resolution

import { prisma } from '../utils/prisma'
import {
  clusterConfig,
  k8sConfig,
  isClusterMode,
  getCurrentNodeId,
  buildNodeHost,
  parseNodeHost,
} from '../utils/cluster-config'
import type { NodeInfo, IDynamicNodeDiscovery } from '~~/types/cluster'
import dns from 'node:dns'
import { promisify } from 'node:util'

// Promisified DNS resolve
const dnsResolve4 = promisify(dns.resolve4)
const dnsResolveSrv = promisify(dns.resolveSrv)

// Node cache
let nodeCache: NodeInfo[] = []
let nodeCacheTime = 0
const NODE_CACHE_TTL = 10000 // 10 seconds

// Offline threshold - nodes not seen in 90 seconds are considered stale
const OFFLINE_THRESHOLD_MS = 90 * 1000

// Round-robin counter
let roundRobinCounter = 0

/**
 * Dynamic Node Discovery Service
 */
class DynamicNodeDiscovery implements IDynamicNodeDiscovery {
  /**
   * Discover all online nodes from database
   * Includes nodes with status 'online' or recent heartbeat
   */
  async discoverOnlineNodes(): Promise<NodeInfo[]> {
    const now = Date.now()

    // Check cache
    if (nodeCache.length > 0 && now - nodeCacheTime < NODE_CACHE_TTL) {
      return nodeCache
    }

    const offlineThreshold = new Date(now - OFFLINE_THRESHOLD_MS)

    const nodes = await prisma.node.findMany({
      where: {
        active: true,
        OR: [
          { status: 'online' },
          { lastSeen: { gte: offlineThreshold } },
        ],
      },
      orderBy: [
        { isPrimary: 'desc' },
        { nodeId: 'asc' },
      ],
    })

    // Update cache
    nodeCache = nodes as NodeInfo[]
    nodeCacheTime = now

    console.log(`[NodeDiscovery] Discovered ${nodes.length} online nodes`)
    return nodeCache
  }

  /**
   * Resolve K8s headless service to pod IPs
   * Uses DNS SRV or A record queries
   */
  async resolveK8sHeadlessService(): Promise<string[]> {
    if (!k8sConfig.enabled) {
      return []
    }

    // Construct FQDN for headless service
    const fqdn = `${k8sConfig.headlessService}.${k8sConfig.namespace}.svc.cluster.local`

    try {
      // Try SRV record first (provides port information)
      const srvRecords = await dnsResolveSrv(fqdn)

      if (srvRecords && srvRecords.length > 0) {
        const hosts = srvRecords.map((record) =>
          `${record.name}:${record.port}`
        )
        console.log(`[NodeDiscovery] K8s SRV resolved: ${hosts.length} endpoints`)
        return hosts
      }
    } catch {
      // SRV query failed, try A record
      console.log('[NodeDiscovery] K8s SRV query failed, trying A record')
    }

    try {
      // Fallback to A record
      const ips = await dnsResolve4(fqdn)

      if (ips && ips.length > 0) {
        const hosts = ips.map((ip) => `${ip}:${clusterConfig.defaultPort}`)
        console.log(`[NodeDiscovery] K8s A record resolved: ${hosts.length} endpoints`)
        return hosts
      }
    } catch (error) {
      console.error('[NodeDiscovery] K8s DNS resolution failed:', error)
    }

    return []
  }

  /**
   * Get the primary node
   */
  async getPrimaryNode(): Promise<NodeInfo | null> {
    const nodes = await this.discoverOnlineNodes()

    // Find explicitly marked primary
    const primary = nodes.find((n) => n.isPrimary)
    if (primary) {
      return primary
    }

    // Return first node if no explicit primary
    if (nodes.length > 0) {
      return nodes[0]
    }

    return null
  }

  /**
   * Select node using round-robin for load balancing
   */
  async selectNodeRoundRobin(): Promise<NodeInfo | null> {
    const nodes = await this.discoverOnlineNodes()

    if (nodes.length === 0) {
      console.warn('[NodeDiscovery] No available nodes for round-robin selection')
      return null
    }

    roundRobinCounter++
    const index = (roundRobinCounter - 1) % nodes.length

    return nodes[index]
  }

  /**
   * Select node with least load (fewest monitors)
   */
  async selectNodeLeastLoad(): Promise<NodeInfo | null> {
    const result = await prisma.$queryRaw<
      Array<{
        nodeId: string
        nodeName: string
        host: string | null
        isPrimary: boolean
        status: string
        monitorCount: bigint
      }>
    >`
      SELECT 
        n.node_id as "nodeId",
        n.node_name as "nodeName",
        n.host,
        n.is_primary as "isPrimary",
        n.status,
        COALESCE(COUNT(m.id), 0) as "monitorCount"
      FROM nodes n
      LEFT JOIN monitors m ON (m.node_id = n.node_id OR m.assigned_node = n.node_id) AND m.active = true
      WHERE n.status = 'online' AND n.active = true
      GROUP BY n.id, n.node_id, n.node_name, n.host, n.is_primary, n.status
      ORDER BY "monitorCount" ASC, n.node_id ASC
      LIMIT 1
    `

    if (!result || result.length === 0) {
      // Fallback to round-robin
      return this.selectNodeRoundRobin()
    }

    const row = result[0]
    return {
      id: 0,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      host: row.host,
      hostname: null,
      location: null,
      status: row.status as 'online' | 'offline' | 'unknown',
      active: true,
      isPrimary: row.isPrimary,
      lastSeen: null,
      lastError: null,
      createdAt: new Date(),
      modifiedAt: new Date(),
      monitorCount: Number(row.monitorCount),
    }
  }

  /**
   * Register current node in the cluster
   */
  async registerNode(nodeId: string, host: string): Promise<NodeInfo> {
    const { hostname } = parseNodeHost(host)

    const node = await prisma.node.upsert({
      where: { nodeId },
      update: {
        host,
        hostname,
        status: 'online',
        lastSeen: new Date(),
        lastError: null,
        active: true,
      },
      create: {
        nodeId,
        nodeName: nodeId,
        host,
        hostname,
        status: 'online',
        lastSeen: new Date(),
        active: true,
        isPrimary: false,
      },
    })

    console.log(`[NodeDiscovery] Registered node ${nodeId} at ${host}`)

    // Clear cache to refresh node list
    this.refreshCache()

    return node as NodeInfo
  }

  /**
   * Unregister node from cluster
   */
  async unregisterNode(nodeId: string): Promise<void> {
    await prisma.node.update({
      where: { nodeId },
      data: {
        status: 'offline',
        active: false,
      },
    })

    console.log(`[NodeDiscovery] Unregistered node ${nodeId}`)

    // Clear cache
    this.refreshCache()
  }

  /**
   * Send heartbeat for current node
   */
  async sendHeartbeat(): Promise<void> {
    const currentNodeId = getCurrentNodeId()

    await prisma.node.updateMany({
      where: { nodeId: currentNodeId },
      data: {
        lastSeen: new Date(),
        status: 'online',
      },
    })
  }

  /**
   * Refresh node cache
   */
  refreshCache(): void {
    nodeCache = []
    nodeCacheTime = 0
  }

  /**
   * Get node statistics
   */
  async getStats(): Promise<{ total: number; primary: number; secondary: number }> {
    const nodes = await this.discoverOnlineNodes()

    const stats = {
      total: nodes.length,
      primary: 0,
      secondary: 0,
    }

    for (const node of nodes) {
      if (node.isPrimary) {
        stats.primary++
      } else {
        stats.secondary++
      }
    }

    return stats
  }
}

// Singleton instance
export const dynamicNodeDiscovery = new DynamicNodeDiscovery()

/**
 * Discover online nodes (convenience function)
 */
export async function discoverOnlineNodes(): Promise<NodeInfo[]> {
  return dynamicNodeDiscovery.discoverOnlineNodes()
}

/**
 * Get primary node (convenience function)
 */
export async function getPrimaryNode(): Promise<NodeInfo | null> {
  return dynamicNodeDiscovery.getPrimaryNode()
}

/**
 * Select node round-robin (convenience function)
 */
export async function selectNodeRoundRobin(): Promise<NodeInfo | null> {
  return dynamicNodeDiscovery.selectNodeRoundRobin()
}

/**
 * Register current node in cluster
 */
export async function registerCurrentNode(): Promise<NodeInfo | null> {
  if (!isClusterMode()) {
    return null
  }

  const nodeId = getCurrentNodeId()
  const host = buildNodeHost(nodeId)

  return dynamicNodeDiscovery.registerNode(nodeId, host)
}

/**
 * Send heartbeat for current node
 */
export async function sendNodeHeartbeat(): Promise<void> {
  return dynamicNodeDiscovery.sendHeartbeat()
}

export default dynamicNodeDiscovery

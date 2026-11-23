// types/cluster.ts
// Type definitions for cluster/node management in SealWatch

/**
 * Cluster runtime environment
 */
export type ClusterEnvironment = 'kubernetes' | 'docker-compose' | 'standalone'

/**
 * Node status values
 */
export type NodeStatus = 'online' | 'offline' | 'unknown'

/**
 * Cluster configuration settings
 */
export interface ClusterConfig {
  /** Current runtime environment */
  environment: ClusterEnvironment
  /** Number of nodes in the cluster */
  nodeCount: number
  /** Maximum monitors per node */
  monitorLimitPerNode: number
  /** Health check interval in seconds */
  healthCheckInterval: number
  /** Health check timeout in milliseconds */
  healthCheckTimeout: number
  /** Consecutive failures before marking offline */
  consecutiveFailuresThreshold: number
  /** Consecutive successes before marking online */
  consecutiveSuccessThreshold: number
  /** Default port for node communication */
  defaultPort: number
  /** Node host prefix (e.g., 'uptime-kuma-') */
  nodeHostPrefix: string
  /** Default/primary node ID */
  defaultNode: string
}

/**
 * Node information from database
 */
export interface NodeInfo {
  id: number
  nodeId: string
  nodeName: string
  host: string | null
  hostname: string | null
  location: string | null
  status: NodeStatus
  active: boolean
  isPrimary: boolean
  lastSeen: Date | null
  lastError: string | null
  createdAt: Date
  modifiedAt: Date
  /** Computed: number of monitors assigned */
  monitorCount?: number
}

/**
 * Monitor assignment information
 */
export interface MonitorAssignment {
  monitorId: number
  /** Manually assigned node (assigned_node field) */
  assignedNode: string | null
  /** Default node (node_id field) */
  nodeId: string | null
  /** Computed: effective node for execution */
  effectiveNode: string
}

/**
 * Health check result for a single node
 */
export interface HealthCheckResult {
  nodeId: string
  isHealthy: boolean
  responseTime: number
  lastError: string | null
  checkedAt: Date
  httpStatus?: number
}

/**
 * Monitor redistribution event
 */
export interface MonitorRedistribution {
  sourceNode: string
  targetNodes: string[]
  monitorIds: number[]
  affectedCount: number
  timestamp: Date
}

/**
 * Cluster status summary
 */
export interface ClusterStatus {
  environment: ClusterEnvironment
  timestamp: Date
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  totalMonitors: number
  nodes: NodeCapacity[]
}

/**
 * Node capacity information
 */
export interface NodeCapacity {
  nodeId: string
  nodeName: string
  status: NodeStatus
  currentCount: number
  limitPerNode: number
  usagePercent: number
  lastSeen: Date | null
}

/**
 * K8s-specific configuration
 */
export interface K8sConfig {
  enabled: boolean
  namespace: string
  headlessService: string
  dnsServer: string | null
}

/**
 * Node health checker service interface
 */
export interface INodeHealthChecker {
  /** Start periodic health checks */
  start(): void
  /** Stop health checks */
  stop(): void
  /** Check single node health */
  checkNodeHealth(nodeId: string): Promise<HealthCheckResult>
  /** Update node status in database */
  updateNodeStatus(nodeId: string, status: NodeStatus, error?: string): Promise<void>
  /** Redistribute monitors from failed node */
  redistributeMonitors(failedNodeId: string): Promise<MonitorRedistribution | null>
  /** Revert monitors back to original node when it recovers */
  revertMonitors(nodeId: string): Promise<number>
  /** Get all nodes from database */
  getAllNodes(): Promise<NodeInfo[]>
  /** Get online nodes excluding specified node */
  getOnlineNodesExcept(excludeNodeId: string): Promise<NodeInfo[]>
}

/**
 * Monitor distributor service interface
 */
export interface IMonitorDistributor {
  /** Get the effective node for a monitor */
  getNodeForMonitor(monitorId: number): Promise<string>
  /** Assign a node to a new monitor (based on capacity) */
  assignNodeToMonitor(monitorId: number): Promise<string>
  /** Get monitor count for a specific node */
  getMonitorCountByNode(nodeId: string): Promise<number>
  /** Rebalance monitors across all nodes */
  rebalanceMonitors(): Promise<void>
  /** Find available node with lowest load */
  findAvailableNode(): Promise<string | null>
  /** Get cluster capacity summary */
  getClusterCapacity(): Promise<NodeCapacity[]>
  /** Check if setup is complete (has users) */
  isSetupComplete(): Promise<boolean>
}

/**
 * Dynamic node discovery service interface
 */
export interface IDynamicNodeDiscovery {
  /** Discover all online nodes from database */
  discoverOnlineNodes(): Promise<NodeInfo[]>
  /** Resolve K8s headless service to pod IPs */
  resolveK8sHeadlessService(): Promise<string[]>
  /** Get the primary node */
  getPrimaryNode(): Promise<NodeInfo | null>
  /** Select node using round-robin for load balancing */
  selectNodeRoundRobin(): Promise<NodeInfo | null>
  /** Register current node in cluster */
  registerNode(nodeId: string, host: string): Promise<NodeInfo>
  /** Unregister node from cluster */
  unregisterNode(nodeId: string): Promise<void>
}

// server/utils/cluster-config.ts
// Centralized cluster configuration for Uptime Kuma
// Supports Docker Compose, Kubernetes, and standalone environments

import type { ClusterConfig, ClusterEnvironment, K8sConfig } from '~~/types/cluster'

/**
 * Detect the current runtime environment
 */
function detectEnvironment(): ClusterEnvironment {
  // K8s environment - KUBERNETES_SERVICE_HOST is auto-injected by K8s
  if (process.env.KUBERNETES_SERVICE_HOST || process.env.K8S_MODE === 'true') {
    return 'kubernetes'
  }

  // Docker Compose environment
  if (process.env.COMPOSE_PROJECT_NAME) {
    return 'docker-compose'
  }

  // Check for cluster node count
  const nodeCount = parseInt(process.env.CLUSTER_NODE_COUNT || '0', 10)
  if (nodeCount > 1) {
    return 'docker-compose'
  }

  // Default to standalone
  return 'standalone'
}

const environment = detectEnvironment()

/**
 * Kubernetes-specific configuration
 */
export const k8sConfig: K8sConfig = {
  enabled: environment === 'kubernetes',
  namespace: process.env.K8S_NAMESPACE || process.env.NAMESPACE || 'default',
  headlessService: process.env.K8S_HEADLESS_SERVICE || process.env.HEADLESS_SERVICE_NAME || 'uptime-kuma-headless',
  dnsServer: process.env.K8S_DNS_SERVER || null,
}

/**
 * Main cluster configuration
 */
export const clusterConfig: ClusterConfig = {
  environment,
  nodeCount: parseInt(process.env.CLUSTER_NODE_COUNT || '1', 10),
  monitorLimitPerNode: parseInt(process.env.MONITOR_LIMIT_PER_NODE || '1000', 10),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30', 10),
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
  consecutiveFailuresThreshold: parseInt(process.env.HEALTH_CHECK_FAIL_THRESHOLD || '3', 10),
  consecutiveSuccessThreshold: parseInt(process.env.HEALTH_CHECK_SUCCESS_THRESHOLD || '3', 10),
  defaultPort: parseInt(process.env.CLUSTER_DEFAULT_PORT || '3001', 10),

  // Node host prefix based on environment
  // Docker Compose: 'uptime-kuma-' -> uptime-kuma-node1
  // K8s: '' (pod name from StatefulSet is the full hostname)
  nodeHostPrefix: environment === 'kubernetes'
    ? ''
    : (process.env.NODE_HOST_PREFIX || 'uptime-kuma-'),

  // Default node based on environment
  // K8s: uptime-kuma-0 (StatefulSet format)
  // Docker Compose: node1 (traditional format)
  defaultNode: environment === 'kubernetes'
    ? 'uptime-kuma-0'
    : (process.env.DEFAULT_NODE || 'node1'),
}

/**
 * Get current node ID from environment
 */
export function getCurrentNodeId(): string {
  return process.env.NODE_ID || process.env.HOSTNAME || clusterConfig.defaultNode
}

/**
 * Build full host string for a node
 * @param nodeId - The node identifier
 * @param port - Optional port override
 */
export function buildNodeHost(nodeId: string, port?: number): string {
  const actualPort = port || clusterConfig.defaultPort

  if (environment === 'kubernetes') {
    // K8s: pod-name.headless-service.namespace.svc.cluster.local
    return `${nodeId}.${k8sConfig.headlessService}.${k8sConfig.namespace}.svc.cluster.local:${actualPort}`
  }

  // Docker Compose: prefix + nodeId
  return `${clusterConfig.nodeHostPrefix}${nodeId}:${actualPort}`
}

/**
 * Parse host string to extract hostname and port
 */
export function parseNodeHost(host: string): { hostname: string; port: number } {
  const match = host.match(/^([^:]+):?(\d*)$/)
  if (!match) {
    return { hostname: host, port: clusterConfig.defaultPort }
  }

  return {
    hostname: match[1],
    port: match[2] ? parseInt(match[2], 10) : clusterConfig.defaultPort,
  }
}

/**
 * Check if running in cluster mode
 */
export function isClusterMode(): boolean {
  return clusterConfig.nodeCount > 1 || environment !== 'standalone'
}

/**
 * Get health check URL for a node
 */
export function getHealthCheckUrl(host: string): string {
  const { hostname, port } = parseNodeHost(host)
  return `http://${hostname}:${port}/api/v1/health`
}

/**
 * Log cluster configuration on startup
 */
export function logClusterConfig(): void {
  console.log('[Cluster] Configuration:')
  console.log(`  Environment: ${clusterConfig.environment}`)
  console.log(`  Node Count: ${clusterConfig.nodeCount}`)
  console.log(`  Monitor Limit Per Node: ${clusterConfig.monitorLimitPerNode}`)
  console.log(`  Health Check Interval: ${clusterConfig.healthCheckInterval}s`)
  console.log(`  Current Node ID: ${getCurrentNodeId()}`)

  if (k8sConfig.enabled) {
    console.log('[Cluster] K8s Config:')
    console.log(`  Namespace: ${k8sConfig.namespace}`)
    console.log(`  Headless Service: ${k8sConfig.headlessService}`)
  }
}

export default clusterConfig

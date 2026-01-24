// server/plugins/04-node-health.ts
// Nitro plugin for node health management in cluster mode
// Initializes node health checker and registers current node

import { isClusterMode, logClusterConfig, getCurrentNodeId } from '../utils/cluster-config'
import { initializeNodeHealthChecker, stopNodeHealthChecker } from '../services/node-health-checker'
import { registerCurrentNode, sendNodeHeartbeat } from '../services/dynamic-node-discovery'

// Node heartbeat timer
let heartbeatTimer: NodeJS.Timeout | null = null
const HEARTBEAT_INTERVAL = 15000 // 15 seconds

export default defineNitroPlugin(async (nitroApp) => {
  // Log cluster configuration
  logClusterConfig()

  if (!isClusterMode()) {
    console.log('[NodeHealth] Running in standalone mode, skipping cluster initialization')
    return
  }

  const currentNodeId = getCurrentNodeId()
  console.log(`[NodeHealth] Initializing cluster mode for node: ${currentNodeId}`)

  try {
    // Register current node in the cluster
    const registeredNode = await registerCurrentNode()
    if (registeredNode) {
      console.log(`[NodeHealth] Registered node: ${registeredNode.nodeId} at ${registeredNode.host}`)
    }

    // Start node health checker (only primary node will actually run checks)
    await initializeNodeHealthChecker()
    console.log('[NodeHealth] Node health checker initialized')

    // Start periodic heartbeat to keep this node's status updated
    heartbeatTimer = setInterval(async () => {
      try {
        await sendNodeHeartbeat()
      } catch (error) {
        console.error('[NodeHealth] Failed to send heartbeat:', error)
      }
    }, HEARTBEAT_INTERVAL)

    console.log(`[NodeHealth] Heartbeat started (interval: ${HEARTBEAT_INTERVAL / 1000}s)`)
  } catch (error) {
    console.error('[NodeHealth] Failed to initialize cluster mode:', error)
  }

  // Register shutdown hook
  nitroApp.hooks.hook('close', async () => {
    console.log('[NodeHealth] Shutting down...')

    // Stop heartbeat
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }

    // Stop health checker
    stopNodeHealthChecker()

    console.log('[NodeHealth] Shutdown complete')
  })
})

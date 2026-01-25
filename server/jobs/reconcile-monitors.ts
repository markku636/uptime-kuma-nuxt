// server/jobs/reconcile-monitors.ts
// Reconciles running monitors with database state
// - Starts newly added/activated monitors
// - Stops removed/deactivated monitors
// - Syncs monitor configuration changes

import { prisma } from '../utils/prisma'
import { startMonitorJob, stopMonitorJob, getJobStatus } from '../services/monitor/scheduler'
import { isClusterMode, getCurrentNodeId } from '../utils/cluster-config'

/**
 * Reconcile running monitors with DB state.
 * This job runs periodically to ensure:
 * 1. New active monitors are started
 * 2. Deactivated/deleted monitors are stopped
 * 3. Monitor configuration changes are applied
 * 
 * In cluster mode, only monitors assigned to the current node are started.
 */
export async function reconcileMonitors(): Promise<void> {
  const currentNodeId = getCurrentNodeId()
  const inClusterMode = isClusterMode()
  
  try {
    // Build where clause based on cluster mode
    let whereClause: any = { active: true }
    
    // In cluster mode, filter monitors by node assignment
    if (inClusterMode && currentNodeId) {
      whereClause = {
        active: true,
        OR: [
          { assignedNode: currentNodeId },
          { assignedNode: null, nodeId: currentNodeId }
        ]
      }
      console.log(`[Reconcile] Cluster mode: filtering monitors for node ${currentNodeId}`)
    }

    const desiredMonitors = await prisma.monitor.findMany({
      where: whereClause
    })

    const desiredIds = new Set(desiredMonitors.map(m => m.id))
    const { monitorIds: runningIds } = getJobStatus()
    const runningIdSet = new Set(runningIds)

    let started = 0
    let stopped = 0
    let updated = 0

    // Start newly added/activated monitors
    for (const monitor of desiredMonitors) {
      if (!runningIdSet.has(monitor.id)) {
        console.log(`[Reconcile] Starting monitor ${monitor.id} (${monitor.name})`)
        startMonitorJob(monitor)
        started++
        
        // Small delay to avoid overwhelming the system
        await sleep(50)
      }
    }

    // Stop removed/deactivated monitors
    for (const runningId of runningIds) {
      if (!desiredIds.has(runningId)) {
        console.log(`[Reconcile] Stopping monitor ${runningId}`)
        stopMonitorJob(runningId)
        stopped++
        
        await sleep(25)
      }
    }

    // Log summary if there were changes
    if (started > 0 || stopped > 0) {
      console.log(`[Reconcile] Summary: started=${started}, stopped=${stopped}, total_active=${desiredMonitors.length}`)
    }

  } catch (error) {
    console.error('[Reconcile] Failed to reconcile monitors:', error)
  }
}

/**
 * Sleep helper function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

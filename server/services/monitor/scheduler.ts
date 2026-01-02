// server/services/monitor/scheduler.ts
import { prisma } from '../../utils/prisma'
import { checkMonitor, type CheckResult } from './checker'
import { emitHeartbeat } from '../socket'
import { sendNotificationForMonitor } from '../notification/sender'

// Store active monitor jobs
const jobs = new Map<number, NodeJS.Timeout>()

/**
 * Start monitoring job for a single monitor
 */
export function startMonitorJob(monitor: any) {
  // Clear existing job if any
  stopMonitorJob(monitor.id)

  // Don't start if monitor is not active
  if (!monitor.active) {
    console.log(`[Scheduler] Monitor ${monitor.id} (${monitor.name}) is not active, skipping`)
    return
  }

  // Push monitors don't need scheduled jobs
  if (monitor.type === 'push') {
    console.log(`[Scheduler] Monitor ${monitor.id} (${monitor.name}) is push type, skipping scheduler`)
    return
  }

  const intervalMs = (monitor.interval || 60) * 1000

  console.log(`[Scheduler] Starting monitor ${monitor.id} (${monitor.name}) with interval ${intervalMs}ms`)

  // Run check immediately
  runCheck(monitor)

  // Schedule periodic checks
  const job = setInterval(() => {
    runCheck(monitor)
  }, intervalMs)

  jobs.set(monitor.id, job)
}

/**
 * Stop monitoring job for a monitor
 */
export function stopMonitorJob(monitorId: number) {
  const job = jobs.get(monitorId)
  if (job) {
    clearInterval(job)
    jobs.delete(monitorId)
    console.log(`[Scheduler] Stopped monitor ${monitorId}`)
  }
}

/**
 * Stop all monitoring jobs
 */
export function stopAllJobs() {
  for (const [id, job] of jobs) {
    clearInterval(job)
    console.log(`[Scheduler] Stopped monitor ${id}`)
  }
  jobs.clear()
}

/**
 * Run a single check for a monitor
 */
async function runCheck(monitor: any) {
  let retryCount = 0
  const maxRetries = monitor.maxretries || 0
  let result: CheckResult

  do {
    result = await checkMonitor(monitor)
    
    if (result.status === 1 || retryCount >= maxRetries) {
      break
    }

    retryCount++
    console.log(`[Scheduler] Monitor ${monitor.id} retry ${retryCount}/${maxRetries}`)
    
    // Wait for retry interval before next attempt
    await new Promise(resolve => 
      setTimeout(resolve, (monitor.retryInterval || 60) * 1000)
    )
  } while (retryCount <= maxRetries)

  // Get previous heartbeat to check for status change
  const previousHeartbeat = await prisma.heartbeat.findFirst({
    where: { monitorId: monitor.id },
    orderBy: { time: 'desc' }
  })

  const isImportant = !previousHeartbeat || previousHeartbeat.status !== result.status

  // Save heartbeat
  const heartbeat = await prisma.heartbeat.create({
    data: {
      monitorId: monitor.id,
      status: result.status,
      ping: result.ping,
      msg: result.msg,
      important: isImportant,
      duration: previousHeartbeat 
        ? Math.floor((Date.now() - new Date(previousHeartbeat.time).getTime()) / 1000)
        : 0,
    }
  })

  // Emit heartbeat via Socket.io
  emitHeartbeat(monitor.id, {
    id: heartbeat.id.toString(),
    status: heartbeat.status,
    time: heartbeat.time.toISOString(),
    msg: heartbeat.msg,
    ping: heartbeat.ping,
    important: heartbeat.important,
    duration: heartbeat.duration,
  })

  // Send notifications if status changed
  if (isImportant && previousHeartbeat) {
    await sendNotificationForMonitor(monitor, result, previousHeartbeat.status)
  }

  console.log(`[Scheduler] Monitor ${monitor.id} (${monitor.name}): ${result.status === 1 ? 'UP' : 'DOWN'} - ${result.msg} (${result.ping}ms)`)
}

/**
 * Initialize scheduler - start all active monitors
 */
export async function initializeScheduler() {
  console.log('[Scheduler] Initializing...')

  const monitors = await prisma.monitor.findMany({
    where: { active: true }
  })

  console.log(`[Scheduler] Found ${monitors.length} active monitors`)

  for (const monitor of monitors) {
    startMonitorJob(monitor)
  }

  console.log('[Scheduler] Initialization complete')
}

/**
 * Get status of all jobs
 */
export function getJobStatus() {
  return {
    activeJobs: jobs.size,
    monitorIds: Array.from(jobs.keys())
  }
}

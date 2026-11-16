// server/services/maintenance/scheduler.ts
// Runs timers that notify dashboards when maintenance windows open/close.
// Whether a maintenance is active is computed from its configuration
// (see ./schedule.ts), so in-memory jobs only drive broadcasts.

import { Cron } from 'croner'
import { prisma } from '../../utils/prisma'
import { broadcastMaintenanceList } from '../socket'
import {
  computeStatus,
  computeTimeslots,
  createCron,
  dateToWallTime,
  getTimezoneOffset,
  getTimezoneOption,
  parseTimeRange,
  resolveTimezone,
  safeJsonParse,
  shouldFire,
  validateCron as validateCronPattern,
  type MaintenanceLike,
  type MaintenanceStatus,
  type Timeslot,
} from './schedule'

interface MaintenanceJob {
  id: number
  timers: Cron[]
}

const maintenanceJobs = new Map<number, MaintenanceJob>()

function notify(userId: number) {
  broadcastMaintenanceList(userId).catch(err => {
    console.error('[MaintenanceScheduler] Broadcast failed:', err)
  })
}

/** One-shot timer that tolerates far-future dates (setTimeout overflows after ~24.8 days) */
function at(date: Date, fn: () => void): Cron | null {
  if (date.getTime() <= Date.now()) return null
  return new Cron(date, { maxRuns: 1 }, fn)
}

export async function getMaintenanceStatus(maintenance: MaintenanceLike): Promise<MaintenanceStatus> {
  return computeStatus(maintenance)
}

/**
 * True when the monitor, or any of its parent groups, is covered by a
 * maintenance that is currently under maintenance.
 */
export async function isMonitorUnderMaintenance(monitorId: number): Promise<boolean> {
  const ids: number[] = [monitorId]
  let currentId: number | null = monitorId
  for (let depth = 0; depth < 10 && currentId; depth++) {
    const row: { parent: number | null } | null = await prisma.monitor.findUnique({
      where: { id: currentId },
      select: { parent: true },
    })
    currentId = row?.parent ?? null
    if (currentId && !ids.includes(currentId)) ids.push(currentId)
    else break
  }

  const links = await prisma.maintenanceMonitor.findMany({
    where: { monitorId: { in: ids } },
    include: { maintenance: true },
  })

  return links.some(link => computeStatus(link.maintenance) === 'under-maintenance')
}

export async function startMaintenanceJob(maintenance: MaintenanceLike & { userId: number; title?: string }): Promise<void> {
  stopMaintenanceJob(maintenance.id)
  if (!maintenance.active || maintenance.strategy === 'manual') return

  const job: MaintenanceJob = { id: maintenance.id, timers: [] }
  const userId = maintenance.userId
  const push = (timer: Cron | null) => { if (timer) job.timers.push(timer) }

  try {
    if (maintenance.startDate) push(at(new Date(maintenance.startDate), () => notify(userId)))
    if (maintenance.endDate) push(at(new Date(maintenance.endDate), () => notify(userId)))

    if (maintenance.strategy !== 'single') {
      const created = createCron(maintenance, () => {
        const run = new Date()
        if (!shouldFire(maintenance, run)) return
        notify(userId)
        push(at(new Date(run.getTime() + created!.duration * 1000), () => notify(userId)))
      })
      if (created) {
        push(created.job)
        // If we are inside a window right now, make sure its end is announced
        const running = computeTimeslots(maintenance).find(s => new Date(s.startDate).getTime() <= Date.now())
        if (running) push(at(new Date(running.endDate), () => notify(userId)))
      } else {
        console.warn(`[MaintenanceScheduler] Maintenance ${maintenance.id} has no valid schedule`)
      }
    }
  } catch (e) {
    console.error(`[MaintenanceScheduler] Failed to schedule maintenance ${maintenance.id}:`, e)
  }

  maintenanceJobs.set(maintenance.id, job)
}

export function stopMaintenanceJob(maintenanceId: number): void {
  const job = maintenanceJobs.get(maintenanceId)
  if (!job) return
  for (const timer of job.timers) timer.stop()
  maintenanceJobs.delete(maintenanceId)
}

export function stopAllMaintenanceJobs(): void {
  for (const id of [...maintenanceJobs.keys()]) stopMaintenanceJob(id)
}

export async function getMaintenanceTimeslots(maintenance: MaintenanceLike): Promise<Timeslot[]> {
  return computeTimeslots(maintenance)
}

type MaintenanceRow = MaintenanceLike & {
  title: string
  description?: string | null
  monitors?: { monitorId: number }[]
  statusPages?: { statusPageId: number }[]
}

export async function maintenanceToPublicJSON(maintenance: MaintenanceRow) {
  const tz = resolveTimezone(maintenance)
  const range = parseTimeRange(maintenance.timeRange)
  const duration = maintenance.duration || 3600

  return {
    id: maintenance.id,
    title: maintenance.title,
    description: maintenance.description ?? '',
    strategy: maintenance.strategy,
    intervalDay: maintenance.intervalDay ?? 1,
    active: maintenance.active,
    // Wall-clock strings in the maintenance timezone, as entered in the form
    dateRange: [dateToWallTime(maintenance.startDate, tz), dateToWallTime(maintenance.endDate, tz)],
    timeRange: range ?? [{ hours: 2, minutes: 0 }, { hours: 3, minutes: 0 }],
    weekdays: safeJsonParse<number[]>(maintenance.weekdays, []),
    daysOfMonth: safeJsonParse<(number | string)[]>(maintenance.daysOfMonth, []),
    timeslotList: computeTimeslots(maintenance),
    cron: maintenance.cron ?? '',
    duration,
    durationMinutes: Math.round(duration / 60),
    timezone: tz,
    timezoneOption: getTimezoneOption(maintenance),
    timezoneOffset: getTimezoneOffset(tz),
    status: computeStatus(maintenance),
    monitors: maintenance.monitors?.map(m => m.monitorId),
    statusPages: maintenance.statusPages?.map(s => s.statusPageId),
  }
}

export type MaintenancePublicJSON = Awaited<ReturnType<typeof maintenanceToPublicJSON>>

export async function initializeMaintenanceScheduler(): Promise<void> {
  const maintenances = await prisma.maintenance.findMany({ where: { active: true } })
  for (const maintenance of maintenances) {
    await startMaintenanceJob(maintenance)
  }
  console.log(`[MaintenanceScheduler] Scheduled ${maintenances.length} active maintenance(s)`)
}

export function validateCron(cronExpression: string): boolean {
  return validateCronPattern(cronExpression)
}

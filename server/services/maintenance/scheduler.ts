// server/services/maintenance/scheduler.ts
// Maintenance scheduler service - manages cron jobs for maintenance windows

import { Cron } from 'croner'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { prisma } from '../../utils/prisma'
import { broadcastMaintenanceList } from '../socket'

// Extend dayjs with timezone support
dayjs.extend(utc)
dayjs.extend(timezone)

// Types
interface MaintenanceJob {
  id: number
  cronJob: Cron | null
  durationTimeout: NodeJS.Timeout | null
  status: 'inactive' | 'scheduled' | 'under-maintenance' | 'ended'
}

interface MaintenanceTimeslot {
  startDate: string
  endDate: string
}

// Store active maintenance jobs
const maintenanceJobs = new Map<number, MaintenanceJob>()

/**
 * Get the effective timezone for a maintenance
 */
async function getTimezone(maintenance: any): Promise<string> {
  if (!maintenance.timezone || maintenance.timezone === 'SAME_AS_SERVER') {
    // Default to UTC or server timezone
    return process.env.TZ || 'UTC'
  }
  return maintenance.timezone
}

/**
 * Get timezone offset string (e.g., "+08:00")
 */
async function getTimezoneOffset(maintenance: any): Promise<string> {
  const tz = await getTimezone(maintenance)
  return dayjs.tz(dayjs(), tz).format('Z')
}

/**
 * Calculate maintenance duration from time range
 */
function calcDuration(startTime: string, endTime: string): number {
  const start = dayjs.utc(startTime, 'HH:mm')
  const end = dayjs.utc(endTime, 'HH:mm')
  let duration = end.diff(start, 'second')
  
  // Add 24 hours if it crosses midnight
  if (duration < 0) {
    duration += 24 * 3600
  }
  return duration
}

/**
 * Parse time range from JSON string
 */
function parseTimeRange(timeRangeJson: string | null): { startTime: string; endTime: string } | null {
  if (!timeRangeJson) return null
  try {
    const timeRange = JSON.parse(timeRangeJson)
    if (Array.isArray(timeRange) && timeRange.length >= 2) {
      // Handle both string format "HH:mm" and object format { hours, minutes }
      const formatTime = (t: any): string => {
        if (typeof t === 'string') return t
        if (t && typeof t === 'object') {
          const hours = String(t.hours || t.hour || 0).padStart(2, '0')
          const minutes = String(t.minutes || t.minute || 0).padStart(2, '0')
          return `${hours}:${minutes}`
        }
        return '00:00'
      }
      return {
        startTime: formatTime(timeRange[0]),
        endTime: formatTime(timeRange[1])
      }
    }
  } catch (e) {
    console.error('[MaintenanceScheduler] Failed to parse timeRange:', e)
  }
  return null
}

/**
 * Get the currently running timeslot if any
 */
function getRunningTimeslot(job: MaintenanceJob, cronJob: Cron, duration: number): MaintenanceTimeslot | null {
  if (!cronJob) return null
  
  // Get the previous run time (within duration window)
  const checkTime = dayjs().subtract(duration, 'second').toDate()
  const nextRun = cronJob.nextRun(checkTime)
  
  if (!nextRun) return null
  
  const start = dayjs(nextRun)
  const end = start.add(duration, 'second')
  const current = dayjs()
  
  if (current.isAfter(start) && current.isBefore(end)) {
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    }
  }
  
  return null
}

/**
 * Get the current status of a maintenance
 */
export async function getMaintenanceStatus(maintenance: any): Promise<string> {
  if (!maintenance.active) {
    return 'inactive'
  }
  
  if (maintenance.strategy === 'manual') {
    return 'under-maintenance'
  }
  
  const tz = await getTimezone(maintenance)
  
  // Check if maintenance has started
  if (maintenance.startDate) {
    const startDate = dayjs.tz(maintenance.startDate, tz)
    if (dayjs().isBefore(startDate)) {
      return 'scheduled'
    }
  }
  
  // Check if maintenance has ended
  if (maintenance.endDate) {
    const endDate = dayjs.tz(maintenance.endDate, tz)
    if (dayjs().isAfter(endDate)) {
      return 'ended'
    }
  }
  
  if (maintenance.strategy === 'single') {
    return 'under-maintenance'
  }
  
  // Check job status
  const job = maintenanceJobs.get(maintenance.id)
  if (job) {
    return job.status
  }
  
  return 'unknown'
}

/**
 * Check if a monitor is under any active maintenance
 */
export async function isMonitorUnderMaintenance(monitorId: number): Promise<boolean> {
  // Get all maintenances that include this monitor
  const maintenanceMonitors = await prisma.maintenanceMonitor.findMany({
    where: { monitorId },
    include: {
      maintenance: true
    }
  })
  
  for (const mm of maintenanceMonitors) {
    const status = await getMaintenanceStatus(mm.maintenance)
    if (status === 'under-maintenance') {
      return true
    }
  }
  
  return false
}

/**
 * Generate cron expression for recurring maintenance
 */
async function generateCron(maintenance: any): Promise<{ cron: string; duration: number }> {
  const timeRange = parseTimeRange(maintenance.timeRange)
  
  if (maintenance.strategy === 'cron') {
    // User-defined cron, use duration field
    return {
      cron: maintenance.cron || '',
      duration: maintenance.duration || 60
    }
  }
  
  if (maintenance.strategy === 'recurring-weekday') {
    // Recurring on specific weekdays
    const weekdays = maintenance.weekdays ? JSON.parse(maintenance.weekdays) : []
    if (!timeRange || weekdays.length === 0) {
      return { cron: '', duration: 0 }
    }
    
    const [hour, minute] = timeRange.startTime.split(':').map(Number)
    const duration = calcDuration(timeRange.startTime, timeRange.endTime)
    const cron = `${minute} ${hour} * * ${weekdays.sort((a: number, b: number) => a - b).join(',')}`
    
    return { cron, duration }
  }
  
  if (maintenance.strategy === 'recurring-day-of-month') {
    // Recurring on specific days of month
    const daysOfMonth = maintenance.daysOfMonth ? JSON.parse(maintenance.daysOfMonth) : []
    if (!timeRange || daysOfMonth.length === 0) {
      return { cron: '', duration: 0 }
    }
    
    const [hour, minute] = timeRange.startTime.split(':').map(Number)
    const duration = calcDuration(timeRange.startTime, timeRange.endTime)
    
    // Handle "lastDay" special values
    const dayList: string[] = []
    for (const day of daysOfMonth) {
      if (typeof day === 'string' && day.startsWith('lastDay')) {
        if (day === 'lastDay1') {
          dayList.push('L')
        }
        // lastDay2-4 not supported by standard cron
      } else {
        dayList.push(String(day))
      }
    }
    
    const uniqueDays = [...new Set(dayList)]
    const cron = `${minute} ${hour} ${uniqueDays.join(',')} * *`
    
    return { cron, duration }
  }
  
  if (maintenance.strategy === 'recurring-interval') {
    // Recurring with interval (every N days)
    if (!timeRange) {
      return { cron: '', duration: 0 }
    }
    
    const duration = calcDuration(timeRange.startTime, timeRange.endTime)
    // For interval-based, we use a simple daily cron and handle interval in the job
    return { cron: '* * * * *', duration }
  }
  
  return { cron: '', duration: 0 }
}

/**
 * Start the cron job for a maintenance
 */
export async function startMaintenanceJob(maintenance: any): Promise<void> {
  // Stop existing job if any
  stopMaintenanceJob(maintenance.id)
  
  if (!maintenance.active) {
    console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} is inactive, skipping`)
    return
  }
  
  console.log(`[MaintenanceScheduler] Starting maintenance ${maintenance.id} (${maintenance.title}) - Strategy: ${maintenance.strategy}`)
  
  const job: MaintenanceJob = {
    id: maintenance.id,
    cronJob: null,
    durationTimeout: null,
    status: 'inactive'
  }
  
  if (maintenance.strategy === 'manual') {
    // Manual maintenance is always under maintenance when active
    job.status = 'under-maintenance'
    maintenanceJobs.set(maintenance.id, job)
    console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} is manual, always under maintenance`)
    return
  }
  
  if (maintenance.strategy === 'single') {
    // Single occurrence - use start date as trigger
    if (!maintenance.startDate) {
      console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} has no start date`)
      return
    }
    
    const tz = await getTimezone(maintenance)
    const startDate = new Date(maintenance.startDate)
    
    try {
      job.cronJob = new Cron(startDate, { timezone: tz }, () => {
        console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} is now under maintenance (single)`)
        job.status = 'under-maintenance'
        broadcastMaintenanceList(maintenance.userId)
      })
      job.status = 'scheduled'
    } catch (e) {
      console.error(`[MaintenanceScheduler] Failed to create cron for maintenance ${maintenance.id}:`, e)
    }
    
    maintenanceJobs.set(maintenance.id, job)
    return
  }
  
  // Recurring or cron-based maintenance
  const { cron, duration } = await generateCron(maintenance)
  
  if (!cron) {
    console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} has no valid cron expression`)
    return
  }
  
  console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} cron: ${cron}, duration: ${duration}s`)
  
  try {
    const tz = await getTimezone(maintenance)
    
    // Create the maintenance start event handler
    const startEvent = (customDuration = 0) => {
      console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} is now under maintenance`)
      
      job.status = 'under-maintenance'
      
      // Clear any existing duration timeout
      if (job.durationTimeout) {
        clearTimeout(job.durationTimeout)
      }
      
      // Calculate effective duration
      let effectiveDuration = customDuration > 0 ? customDuration : duration * 1000
      
      // If there's an end date, don't exceed it
      if (maintenance.endDate) {
        const remainingTime = dayjs(maintenance.endDate).diff(dayjs(), 'millisecond')
        if (remainingTime < effectiveDuration) {
          effectiveDuration = remainingTime
        }
      }
      
      // Broadcast status change
      broadcastMaintenanceList(maintenance.userId)
      
      // Set timeout for end of maintenance window
      job.durationTimeout = setTimeout(() => {
        console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} timeslot ended`)
        job.status = 'scheduled'
        broadcastMaintenanceList(maintenance.userId)
      }, effectiveDuration)
    }
    
    // Create the cron job
    if (maintenance.strategy === 'recurring-interval') {
      // For interval-based, we need special handling
      const startDate = maintenance.startDate ? dayjs(maintenance.startDate) : dayjs()
      const timeRange = parseTimeRange(maintenance.timeRange)
      
      if (timeRange) {
        const [hour, minute] = timeRange.startTime.split(':').map(Number)
        const startDateTime = startDate.hour(hour).minute(minute)
        
        job.cronJob = new Cron(cron, {
          timezone: tz,
          interval: (maintenance.intervalDay || 1) * 24 * 60 * 60,
          startAt: startDateTime.toISOString()
        }, () => startEvent())
      }
    } else {
      job.cronJob = new Cron(cron, { timezone: tz }, () => startEvent())
    }
    
    job.status = 'scheduled'
    
    // Check if we're currently in a maintenance window
    if (job.cronJob) {
      const runningTimeslot = getRunningTimeslot(job, job.cronJob, duration)
      if (runningTimeslot) {
        const remainingDuration = dayjs(runningTimeslot.endDate).diff(dayjs(), 'millisecond')
        console.log(`[MaintenanceScheduler] Maintenance ${maintenance.id} is currently running, remaining: ${remainingDuration}ms`)
        startEvent(remainingDuration)
      }
    }
    
  } catch (e) {
    console.error(`[MaintenanceScheduler] Failed to create cron for maintenance ${maintenance.id}:`, e)
    job.status = 'inactive'
  }
  
  maintenanceJobs.set(maintenance.id, job)
}

/**
 * Stop the cron job for a maintenance
 */
export function stopMaintenanceJob(maintenanceId: number): void {
  const job = maintenanceJobs.get(maintenanceId)
  if (job) {
    if (job.cronJob) {
      job.cronJob.stop()
    }
    if (job.durationTimeout) {
      clearTimeout(job.durationTimeout)
    }
    maintenanceJobs.delete(maintenanceId)
    console.log(`[MaintenanceScheduler] Stopped maintenance ${maintenanceId}`)
  }
}

/**
 * Stop all maintenance jobs
 */
export function stopAllMaintenanceJobs(): void {
  for (const [id, job] of maintenanceJobs) {
    if (job.cronJob) {
      job.cronJob.stop()
    }
    if (job.durationTimeout) {
      clearTimeout(job.durationTimeout)
    }
    console.log(`[MaintenanceScheduler] Stopped maintenance ${id}`)
  }
  maintenanceJobs.clear()
}

/**
 * Get timeslot list for a maintenance (for UI display)
 */
export async function getMaintenanceTimeslots(maintenance: any): Promise<MaintenanceTimeslot[]> {
  const timeslots: MaintenanceTimeslot[] = []
  
  if (maintenance.strategy === 'manual') {
    // Manual has no timeslots
    return timeslots
  }
  
  if (maintenance.strategy === 'single') {
    if (maintenance.startDate) {
      timeslots.push({
        startDate: new Date(maintenance.startDate).toISOString(),
        endDate: maintenance.endDate 
          ? new Date(maintenance.endDate).toISOString()
          : dayjs(maintenance.startDate).add(maintenance.duration || 60, 'second').toISOString()
      })
    }
    return timeslots
  }
  
  // For recurring/cron, get from job
  const job = maintenanceJobs.get(maintenance.id)
  if (!job || !job.cronJob) {
    return timeslots
  }
  
  const { duration } = await generateCron(maintenance)
  
  // Add running timeslot if any
  const runningTimeslot = getRunningTimeslot(job, job.cronJob, duration)
  if (runningTimeslot) {
    timeslots.push(runningTimeslot)
  }
  
  // Add next scheduled timeslot
  const nextRun = job.cronJob.nextRun()
  if (nextRun) {
    const startDate = dayjs(nextRun)
    timeslots.push({
      startDate: startDate.toISOString(),
      endDate: startDate.add(duration, 'second').toISOString()
    })
  }
  
  return timeslots
}

/**
 * Convert maintenance to public JSON format
 */
export async function maintenanceToPublicJSON(maintenance: any): Promise<any> {
  const status = await getMaintenanceStatus(maintenance)
  const timeslots = await getMaintenanceTimeslots(maintenance)
  
  // Parse stored JSON fields
  let dateRange: (string | null)[] = []
  if (maintenance.dateRange) {
    try {
      dateRange = JSON.parse(maintenance.dateRange)
    } catch {
      if (maintenance.startDate) dateRange.push(new Date(maintenance.startDate).toISOString())
      if (maintenance.endDate) dateRange.push(new Date(maintenance.endDate).toISOString())
    }
  }
  
  let timeRange: any[] = []
  if (maintenance.timeRange) {
    try {
      timeRange = JSON.parse(maintenance.timeRange)
    } catch {
      timeRange = []
    }
  }
  
  let weekdays: number[] = []
  if (maintenance.weekdays) {
    try {
      weekdays = JSON.parse(maintenance.weekdays)
    } catch {
      weekdays = []
    }
  }
  
  let daysOfMonth: (number | string)[] = []
  if (maintenance.daysOfMonth) {
    try {
      daysOfMonth = JSON.parse(maintenance.daysOfMonth)
    } catch {
      daysOfMonth = []
    }
  }
  
  return {
    id: maintenance.id,
    title: maintenance.title,
    description: maintenance.description,
    strategy: maintenance.strategy,
    intervalDay: maintenance.intervalDay,
    active: maintenance.active,
    dateRange,
    timeRange,
    weekdays,
    daysOfMonth,
    timeslotList: timeslots,
    cron: maintenance.cron,
    duration: maintenance.duration,
    durationMinutes: Math.floor((maintenance.duration || 60) / 60),
    timezone: await getTimezone(maintenance),
    timezoneOption: maintenance.timezoneOption || maintenance.timezone,
    timezoneOffset: await getTimezoneOffset(maintenance),
    status
  }
}

/**
 * Initialize all maintenance jobs on server start
 */
export async function initializeMaintenanceScheduler(): Promise<void> {
  console.log('[MaintenanceScheduler] Initializing...')
  
  const maintenances = await prisma.maintenance.findMany({
    where: { active: true }
  })
  
  console.log(`[MaintenanceScheduler] Found ${maintenances.length} active maintenances`)
  
  for (const maintenance of maintenances) {
    await startMaintenanceJob(maintenance)
  }
  
  console.log('[MaintenanceScheduler] Initialization complete')
}

/**
 * Validate a cron expression
 */
export function validateCron(cronExpression: string): boolean {
  try {
    const job = new Cron(cronExpression, () => {})
    job.stop()
    return true
  } catch {
    return false
  }
}

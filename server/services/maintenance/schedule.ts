// Pure scheduling helpers for maintenance windows.
// No database / socket imports here so this file can be unit-tested directly.
// Behaviour mirrors upstream uptime-kuma `server/model/maintenance.js`.

import { Cron } from 'croner'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export const MAINTENANCE_STRATEGIES = [
  'manual',
  'single',
  'cron',
  'recurring-interval',
  'recurring-weekday',
  'recurring-day-of-month',
] as const

export type MaintenanceStrategy = typeof MAINTENANCE_STRATEGIES[number]

export type MaintenanceStatus = 'inactive' | 'scheduled' | 'under-maintenance' | 'ended' | 'unknown'

export const SAME_AS_SERVER = 'SAME_AS_SERVER'

export interface TimeOfDay {
  hours: number
  minutes: number
}

export interface Timeslot {
  startDate: string
  endDate: string
}

/** Fields of the Prisma `Maintenance` row the scheduler cares about */
export interface MaintenanceLike {
  id: number
  strategy: string
  active: boolean
  startDate?: Date | string | null
  endDate?: Date | string | null
  intervalDay?: number | null
  weekdays?: string | null
  daysOfMonth?: string | null
  timeRange?: string | null
  cron?: string | null
  duration?: number | null
  timezone?: string | null
  timezoneOption?: string | null
  createdAt?: Date | string | null
}

export function getServerTimezone(): string {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** The timezone option the user picked (may be SAME_AS_SERVER) */
export function getTimezoneOption(m: Pick<MaintenanceLike, 'timezone' | 'timezoneOption'>): string {
  return m.timezoneOption || m.timezone || 'UTC'
}

/** A real IANA timezone usable by dayjs / croner */
export function resolveTimezone(m: Pick<MaintenanceLike, 'timezone' | 'timezoneOption'>): string {
  const option = getTimezoneOption(m)
  return option === SAME_AS_SERVER ? getServerTimezone() : option
}

export function isValidTimezone(tz: string): boolean {
  if (tz === SAME_AS_SERVER) return true
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function getTimezoneOffset(tz: string, at: Date = new Date()): string {
  return dayjs(at).tz(tz).format('Z')
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function toTimeOfDay(t: unknown): TimeOfDay | null {
  if (typeof t === 'string') {
    const match = /^(\d{1,2}):(\d{2})/.exec(t)
    if (!match) return null
    return { hours: Number(match[1]), minutes: Number(match[2]) }
  }
  if (t && typeof t === 'object') {
    const o = t as Record<string, unknown>
    const hours = Number(o.hours ?? o.hour ?? 0)
    const minutes = Number(o.minutes ?? o.minute ?? 0)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
    return { hours, minutes }
  }
  return null
}

/** Parse stored timeRange JSON: `[{hours,minutes},{hours,minutes}]` or `["HH:mm","HH:mm"]` */
export function parseTimeRange(value: string | null | undefined): [TimeOfDay, TimeOfDay] | null {
  const raw = safeJsonParse<unknown[]>(value, [])
  if (!Array.isArray(raw) || raw.length < 2) return null
  const start = toTimeOfDay(raw[0])
  const end = toTimeOfDay(raw[1])
  if (!start || !end) return null
  return [start, end]
}

/** Window length in seconds; crossing midnight adds 24h, equal times means a full day */
export function calcDuration(start: TimeOfDay, end: TimeOfDay): number {
  let seconds = ((end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes)) * 60
  if (seconds <= 0) seconds += 24 * 3600
  return seconds
}

/**
 * Build the cron pattern and window duration (seconds) for a maintenance.
 * Returns an empty cron for manual/single or incomplete configuration.
 */
export function generateCron(m: MaintenanceLike): { cron: string; duration: number } {
  if (m.strategy === 'cron') {
    return { cron: (m.cron || '').trim(), duration: m.duration && m.duration > 0 ? m.duration : 3600 }
  }

  if (!m.strategy.startsWith('recurring-')) {
    return { cron: '', duration: 0 }
  }

  const range = parseTimeRange(m.timeRange)
  if (!range) return { cron: '', duration: 0 }

  const [start, end] = range
  const duration = calcDuration(start, end)
  const prefix = `${start.minutes} ${start.hours}`

  if (m.strategy === 'recurring-interval') {
    // Fires daily; the interval is enforced by isIntervalRunDay()
    return { cron: `${prefix} * * *`, duration }
  }

  if (m.strategy === 'recurring-weekday') {
    const weekdays = safeJsonParse<unknown[]>(m.weekdays, [])
      .map(Number)
      .filter(d => Number.isInteger(d) && d >= 0 && d <= 7)
    const unique = [...new Set(weekdays.map(d => (d === 7 ? 0 : d)))].sort((a, b) => a - b)
    if (unique.length === 0) return { cron: '', duration: 0 }
    return { cron: `${prefix} * * ${unique.join(',')}`, duration }
  }

  if (m.strategy === 'recurring-day-of-month') {
    const days: string[] = []
    for (const day of safeJsonParse<unknown[]>(m.daysOfMonth, [])) {
      if (typeof day === 'string' && day.startsWith('lastDay')) {
        // Same as upstream: only lastDay1 can be expressed in cron
        if (day === 'lastDay1') days.push('L')
      } else {
        const n = Number(day)
        if (Number.isInteger(n) && n >= 1 && n <= 31) days.push(String(n))
      }
    }
    const unique = [...new Set(days)].sort((a, b) => (a === 'L' ? 1 : b === 'L' ? -1 : Number(a) - Number(b)))
    if (unique.length === 0) return { cron: '', duration: 0 }
    return { cron: `${prefix} ${unique.join(',')} * *`, duration }
  }

  return { cron: '', duration: 0 }
}

export function validateCron(pattern: string): boolean {
  if (!pattern || !pattern.trim()) return false
  try {
    const job = new Cron(pattern, { paused: true })
    job.stop()
    return true
  } catch {
    return false
  }
}

function calendarDay(date: Date | string, tz: string): string {
  return dayjs(date).tz(tz).format('YYYY-MM-DD')
}

/** For recurring-interval: true when `run` falls on a day N*intervalDay after the anchor date */
export function isIntervalRunDay(run: Date, anchor: Date | string, intervalDay: number, tz: string): boolean {
  const interval = Math.max(1, Math.floor(intervalDay || 1))
  if (interval === 1) return true
  const diff = dayjs.utc(calendarDay(run, tz)).diff(dayjs.utc(calendarDay(anchor, tz)), 'day')
  return diff >= 0 && diff % interval === 0
}

export function getIntervalAnchor(m: MaintenanceLike): Date {
  return new Date(m.startDate || m.createdAt || Date.now())
}

/** Create a croner instance (paused when no callback is given) */
export function createCron(m: MaintenanceLike, callback?: () => void): { job: Cron; duration: number } | null {
  const { cron, duration } = generateCron(m)
  if (!cron) return null

  const options: Record<string, unknown> = { timezone: resolveTimezone(m) }
  if (m.startDate) options.startAt = new Date(m.startDate).toISOString()
  if (m.endDate) options.stopAt = new Date(m.endDate).toISOString()
  if (!callback) options.paused = true

  const job = callback ? new Cron(cron, options, callback) : new Cron(cron, options)
  return { job, duration }
}

function acceptsRun(m: MaintenanceLike, run: Date): boolean {
  if (m.strategy !== 'recurring-interval') return true
  return isIntervalRunDay(run, getIntervalAnchor(m), m.intervalDay || 1, resolveTimezone(m))
}

function clampEnd(m: MaintenanceLike, end: dayjs.Dayjs): dayjs.Dayjs {
  if (m.endDate) {
    const hardEnd = dayjs(m.endDate)
    if (hardEnd.isBefore(end)) return hardEnd
  }
  return end
}

/** The window containing `now`, if any */
export function getRunningTimeslot(m: MaintenanceLike, job: Cron, duration: number, now: Date = new Date()): Timeslot | null {
  const current = dayjs(now)
  // Look back far enough to find the window start (croner nextRun is exclusive)
  let cursor: Date | null = current.subtract(duration, 'second').subtract(1, 'second').toDate()
  for (let i = 0; i < 400 && cursor; i++) {
    const run = job.nextRun(cursor)
    if (!run || dayjs(run).isAfter(current)) return null
    if (acceptsRun(m, run)) {
      const start = dayjs(run)
      const end = clampEnd(m, start.add(duration, 'second'))
      if (!current.isBefore(start) && current.isBefore(end)) {
        return { startDate: start.toISOString(), endDate: end.toISOString() }
      }
    }
    cursor = run
  }
  return null
}

/** The next window starting after `now` */
export function getNextTimeslot(m: MaintenanceLike, job: Cron, duration: number, now: Date = new Date()): Timeslot | null {
  let cursor: Date | null = now
  for (let i = 0; i < 400 && cursor; i++) {
    const run = job.nextRun(cursor)
    if (!run) return null
    if (acceptsRun(m, run)) {
      const start = dayjs(run)
      return { startDate: start.toISOString(), endDate: clampEnd(m, start.add(duration, 'second')).toISOString() }
    }
    cursor = run
  }
  return null
}

export function shouldFire(m: MaintenanceLike, run: Date): boolean {
  return acceptsRun(m, run)
}

/**
 * Status computed purely from configuration and the clock.
 * Recurring strategies are evaluated against the cron schedule, so the result
 * is the same on every cluster node regardless of in-memory job state.
 */
export function computeStatus(m: MaintenanceLike, now: Date = new Date()): MaintenanceStatus {
  if (!m.active) return 'inactive'
  if (m.strategy === 'manual') return 'under-maintenance'

  const current = dayjs(now)
  if (m.startDate && current.isBefore(dayjs(m.startDate))) return 'scheduled'
  if (m.endDate && !current.isBefore(dayjs(m.endDate))) return 'ended'

  if (m.strategy === 'single') {
    return m.startDate ? 'under-maintenance' : 'unknown'
  }

  let cron: ReturnType<typeof createCron> = null
  try {
    cron = createCron(m)
  } catch {
    return 'unknown'
  }
  if (!cron) return 'unknown'

  try {
    return getRunningTimeslot(m, cron.job, cron.duration, now) ? 'under-maintenance' : 'scheduled'
  } finally {
    cron.job.stop()
  }
}

export function computeTimeslots(m: MaintenanceLike, now: Date = new Date()): Timeslot[] {
  if (m.strategy === 'manual') return []

  if (m.strategy === 'single') {
    if (!m.startDate) return []
    const start = dayjs(m.startDate)
    const end = m.endDate ? dayjs(m.endDate) : start.add(m.duration || 3600, 'second')
    return [{ startDate: start.toISOString(), endDate: end.toISOString() }]
  }

  let cron: ReturnType<typeof createCron> = null
  try {
    cron = createCron(m)
  } catch {
    return []
  }
  if (!cron) return []

  try {
    const slots: Timeslot[] = []
    const running = getRunningTimeslot(m, cron.job, cron.duration, now)
    if (running) slots.push(running)
    const next = getNextTimeslot(m, cron.job, cron.duration, now)
    if (next) slots.push(next)
    return slots
  } finally {
    cron.job.stop()
  }
}

/** Convert a wall-clock string ("YYYY-MM-DD HH:mm") in `tz` to an instant */
export function wallTimeToDate(value: string | null | undefined, tz: string): Date | null {
  if (!value) return null
  const normalized = value.replace('T', ' ').slice(0, 16)
  const parsed = dayjs.tz(normalized, 'YYYY-MM-DD HH:mm', tz)
  return parsed.isValid() ? parsed.toDate() : null
}

/** Convert an instant to a wall-clock string ("YYYY-MM-DD HH:mm") in `tz` */
export function dateToWallTime(value: Date | string | null | undefined, tz: string): string | null {
  if (!value) return null
  const d = dayjs(value)
  return d.isValid() ? d.tz(tz).format('YYYY-MM-DD HH:mm') : null
}

/** The next `count` windows starting after `now` (for previews) */
export function computeUpcoming(m: MaintenanceLike, count = 3, now: Date = new Date()): Timeslot[] {
  if (m.strategy === 'manual') return []
  if (m.strategy === 'single') {
    return computeTimeslots(m, now).filter(s => new Date(s.endDate) > now)
  }
  let cron: ReturnType<typeof createCron> = null
  try {
    cron = createCron(m)
  } catch {
    return []
  }
  if (!cron) return []
  try {
    const slots: Timeslot[] = []
    let cursor = now
    for (let i = 0; i < count; i++) {
      const next = getNextTimeslot(m, cron.job, cron.duration, cursor)
      if (!next) break
      slots.push(next)
      cursor = new Date(next.startDate)
    }
    return slots
  } finally {
    cron.job.stop()
  }
}

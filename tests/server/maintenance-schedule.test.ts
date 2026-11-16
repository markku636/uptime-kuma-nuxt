import { describe, expect, it } from 'vitest'
import {
  calcDuration,
  computeStatus,
  computeTimeslots,
  dateToWallTime,
  generateCron,
  isIntervalRunDay,
  parseTimeRange,
  validateCron,
  wallTimeToDate,
  type MaintenanceLike,
} from '../../server/services/maintenance/schedule'

const base = (over: Partial<MaintenanceLike>): MaintenanceLike => ({
  id: 1,
  strategy: 'manual',
  active: true,
  timezone: 'UTC',
  timezoneOption: 'UTC',
  ...over,
})

const range = (h1: number, m1: number, h2: number, m2: number) =>
  JSON.stringify([{ hours: h1, minutes: m1 }, { hours: h2, minutes: m2 }])

describe('time range parsing', () => {
  it('accepts object and string formats', () => {
    expect(parseTimeRange(range(2, 30, 4, 0))).toEqual([{ hours: 2, minutes: 30 }, { hours: 4, minutes: 0 }])
    expect(parseTimeRange('["02:30","04:00"]')).toEqual([{ hours: 2, minutes: 30 }, { hours: 4, minutes: 0 }])
    expect(parseTimeRange('garbage')).toBeNull()
    expect(parseTimeRange(null)).toBeNull()
  })

  it('handles windows crossing midnight', () => {
    expect(calcDuration({ hours: 2, minutes: 0 }, { hours: 3, minutes: 30 })).toBe(5400)
    expect(calcDuration({ hours: 23, minutes: 0 }, { hours: 1, minutes: 0 })).toBe(7200)
    expect(calcDuration({ hours: 5, minutes: 0 }, { hours: 5, minutes: 0 })).toBe(86400)
  })
})

describe('generateCron', () => {
  it('builds weekday patterns (sorted, Sunday=0)', () => {
    const m = base({ strategy: 'recurring-weekday', weekdays: '[5,1,7]', timeRange: range(2, 15, 3, 0) })
    expect(generateCron(m)).toEqual({ cron: '15 2 * * 0,1,5', duration: 2700 })
  })

  it('builds day-of-month patterns with lastDay1 as L', () => {
    const m = base({ strategy: 'recurring-day-of-month', daysOfMonth: '["lastDay1",15,1,"lastDay2"]', timeRange: range(0, 0, 1, 0) })
    expect(generateCron(m)).toEqual({ cron: '0 0 1,15,L * *', duration: 3600 })
  })

  it('builds a daily pattern for interval strategy', () => {
    const m = base({ strategy: 'recurring-interval', intervalDay: 3, timeRange: range(4, 5, 6, 5) })
    expect(generateCron(m)).toEqual({ cron: '5 4 * * *', duration: 7200 })
  })

  it('passes through custom cron with stored duration', () => {
    expect(generateCron(base({ strategy: 'cron', cron: '0 1 * * *', duration: 600 }))).toEqual({ cron: '0 1 * * *', duration: 600 })
  })

  it('returns empty cron when configuration is incomplete', () => {
    expect(generateCron(base({ strategy: 'recurring-weekday', weekdays: '[]', timeRange: range(1, 0, 2, 0) })).cron).toBe('')
    expect(generateCron(base({ strategy: 'single' })).cron).toBe('')
  })
})

describe('validateCron', () => {
  it('accepts valid and rejects invalid patterns', () => {
    expect(validateCron('*/5 * * * *')).toBe(true)
    expect(validateCron('0 0 L * *')).toBe(true)
    expect(validateCron('not a cron')).toBe(false)
    expect(validateCron('')).toBe(false)
  })
})

describe('isIntervalRunDay', () => {
  it('matches every N days from the anchor in the given timezone', () => {
    const anchor = new Date('2026-01-01T00:00:00Z')
    expect(isIntervalRunDay(new Date('2026-01-01T02:00:00Z'), anchor, 3, 'UTC')).toBe(true)
    expect(isIntervalRunDay(new Date('2026-01-02T02:00:00Z'), anchor, 3, 'UTC')).toBe(false)
    expect(isIntervalRunDay(new Date('2026-01-04T02:00:00Z'), anchor, 3, 'UTC')).toBe(true)
    expect(isIntervalRunDay(new Date('2025-12-29T02:00:00Z'), anchor, 3, 'UTC')).toBe(false)
  })
})

describe('computeStatus', () => {
  const now = new Date('2026-03-10T02:30:00Z') // Tuesday

  it('handles active flag and manual strategy', () => {
    expect(computeStatus(base({ active: false }), now)).toBe('inactive')
    expect(computeStatus(base({ strategy: 'manual' }), now)).toBe('under-maintenance')
  })

  it('handles single windows', () => {
    const m = base({ strategy: 'single', startDate: '2026-03-10T02:00:00Z', endDate: '2026-03-10T03:00:00Z' })
    expect(computeStatus(m, new Date('2026-03-10T01:59:00Z'))).toBe('scheduled')
    expect(computeStatus(m, now)).toBe('under-maintenance')
    expect(computeStatus(m, new Date('2026-03-10T03:00:00Z'))).toBe('ended')
  })

  it('detects being inside a recurring weekday window', () => {
    const tuesday = base({ strategy: 'recurring-weekday', weekdays: '[2]', timeRange: range(2, 0, 3, 0) })
    expect(computeStatus(tuesday, now)).toBe('under-maintenance')
    expect(computeStatus(tuesday, new Date('2026-03-10T03:01:00Z'))).toBe('scheduled')
    const monday = base({ strategy: 'recurring-weekday', weekdays: '[1]', timeRange: range(2, 0, 3, 0) })
    expect(computeStatus(monday, now)).toBe('scheduled')
  })

  it('respects the maintenance timezone', () => {
    // 10:00-11:00 in Taipei is 02:00-03:00 UTC
    const m = base({ strategy: 'recurring-weekday', weekdays: '[2]', timeRange: range(10, 0, 11, 0), timezone: 'Asia/Taipei', timezoneOption: 'Asia/Taipei' })
    expect(computeStatus(m, now)).toBe('under-maintenance')
  })

  it('handles windows that cross midnight', () => {
    const m = base({ strategy: 'recurring-weekday', weekdays: '[1]', timeRange: range(23, 0, 4, 0) })
    expect(computeStatus(m, now)).toBe('under-maintenance') // Monday 23:00 -> Tuesday 04:00
  })

  it('honours the interval for recurring-interval', () => {
    const every2 = base({ strategy: 'recurring-interval', intervalDay: 2, timeRange: range(2, 0, 3, 0), startDate: '2026-03-01T00:00:00Z' })
    expect(computeStatus(every2, now)).toBe('scheduled') // 9 days after anchor
    expect(computeStatus(every2, new Date('2026-03-11T02:30:00Z'))).toBe('under-maintenance') // 10 days
  })

  it('reports ended after the date range', () => {
    const m = base({ strategy: 'cron', cron: '0 2 * * *', duration: 3600, endDate: '2026-03-01T00:00:00Z' })
    expect(computeStatus(m, now)).toBe('ended')
  })
})

describe('computeTimeslots', () => {
  it('lists running and next windows', () => {
    const now = new Date('2026-03-10T02:30:00Z')
    const m = base({ strategy: 'cron', cron: '0 2 * * *', duration: 3600 })
    expect(computeTimeslots(m, now)).toEqual([
      { startDate: '2026-03-10T02:00:00.000Z', endDate: '2026-03-10T03:00:00.000Z' },
      { startDate: '2026-03-11T02:00:00.000Z', endDate: '2026-03-11T03:00:00.000Z' },
    ])
  })

  it('clamps the last window to the end date', () => {
    const now = new Date('2026-03-10T00:00:00Z')
    const m = base({ strategy: 'cron', cron: '0 2 * * *', duration: 3600, endDate: '2026-03-10T02:30:00Z' })
    expect(computeTimeslots(m, now)).toEqual([
      { startDate: '2026-03-10T02:00:00.000Z', endDate: '2026-03-10T02:30:00.000Z' },
    ])
  })
})

describe('wall time conversion', () => {
  it('round-trips through a timezone', () => {
    const d = wallTimeToDate('2026-03-10 10:00', 'Asia/Taipei')
    expect(d?.toISOString()).toBe('2026-03-10T02:00:00.000Z')
    expect(dateToWallTime(d, 'Asia/Taipei')).toBe('2026-03-10 10:00')
    expect(wallTimeToDate('2026-03-10T10:00', 'UTC')?.toISOString()).toBe('2026-03-10T10:00:00.000Z')
  })
})

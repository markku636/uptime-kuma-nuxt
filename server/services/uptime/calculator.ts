// server/services/uptime/calculator.ts
import { prisma } from '../../utils/prisma'

export interface UptimeResult {
  uptime: number // Percentage (0-100)
  uptimeMs: number // Total up time in milliseconds
  downtimeMs: number // Total down time in milliseconds
  totalMs: number // Total monitored time
  avgPing: number // Average ping in milliseconds
  minPing: number // Minimum ping
  maxPing: number // Maximum ping
  upCount: number // Number of UP heartbeats
  downCount: number // Number of DOWN heartbeats
  totalCount: number // Total heartbeats
}

export interface UptimeByPeriod {
  '24h': UptimeResult
  '7d': UptimeResult
  '30d': UptimeResult
  '1y': UptimeResult
}

/**
 * Calculate uptime for a monitor within a time range
 */
export async function calculateUptime(
  monitorId: number,
  startTime: Date,
  endTime: Date = new Date()
): Promise<UptimeResult> {
  // Get heartbeats within the time range
  const heartbeats = await prisma.heartbeat.findMany({
    where: {
      monitorId,
      time: {
        gte: startTime,
        lte: endTime
      }
    },
    select: {
      status: true,
      ping: true,
      duration: true,
      time: true
    },
    orderBy: { time: 'asc' }
  })

  if (heartbeats.length === 0) {
    return {
      uptime: 0,
      uptimeMs: 0,
      downtimeMs: 0,
      totalMs: 0,
      avgPing: 0,
      minPing: 0,
      maxPing: 0,
      upCount: 0,
      downCount: 0,
      totalCount: 0
    }
  }

  let uptimeMs = 0
  let downtimeMs = 0
  let upCount = 0
  let downCount = 0
  let totalPing = 0
  let pingCount = 0
  let minPing = Infinity
  let maxPing = 0

  for (let i = 0; i < heartbeats.length; i++) {
    const hb = heartbeats[i]
    const duration = hb.duration || 0

    // Status: 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE
    if (hb.status === 1) {
      upCount++
      uptimeMs += duration * 1000
    } else if (hb.status === 0) {
      downCount++
      downtimeMs += duration * 1000
    }

    // Calculate ping stats (only for valid pings)
    if (hb.ping !== null && hb.ping > 0 && hb.status === 1) {
      totalPing += hb.ping
      pingCount++
      minPing = Math.min(minPing, hb.ping)
      maxPing = Math.max(maxPing, hb.ping)
    }
  }

  const totalMs = uptimeMs + downtimeMs
  const uptime = totalMs > 0 ? (uptimeMs / totalMs) * 100 : 0

  return {
    uptime: Math.round(uptime * 100) / 100, // Round to 2 decimal places
    uptimeMs,
    downtimeMs,
    totalMs,
    avgPing: pingCount > 0 ? Math.round(totalPing / pingCount) : 0,
    minPing: minPing === Infinity ? 0 : minPing,
    maxPing,
    upCount,
    downCount,
    totalCount: heartbeats.length
  }
}

/**
 * Calculate uptime for multiple time periods
 */
export async function calculateUptimeByPeriod(monitorId: number): Promise<UptimeByPeriod> {
  const now = new Date()
  
  const [uptime24h, uptime7d, uptime30d, uptime1y] = await Promise.all([
    calculateUptime(monitorId, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    calculateUptime(monitorId, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    calculateUptime(monitorId, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    calculateUptime(monitorId, new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000))
  ])

  return {
    '24h': uptime24h,
    '7d': uptime7d,
    '30d': uptime30d,
    '1y': uptime1y
  }
}

/**
 * Get daily uptime percentages for chart display
 */
export async function getDailyUptimeHistory(
  monitorId: number,
  days: number = 90
): Promise<Array<{ date: string; uptime: number; avgPing: number }>> {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  
  // Get all heartbeats in the range
  const heartbeats = await prisma.heartbeat.findMany({
    where: {
      monitorId,
      time: { gte: startDate }
    },
    select: {
      status: true,
      ping: true,
      time: true
    },
    orderBy: { time: 'asc' }
  })

  // Group by date
  const dailyStats = new Map<string, { up: number; down: number; pings: number[] }>()

  for (const hb of heartbeats) {
    const date = hb.time.toISOString().split('T')[0]
    
    if (!dailyStats.has(date)) {
      dailyStats.set(date, { up: 0, down: 0, pings: [] })
    }

    const stats = dailyStats.get(date)!
    
    if (hb.status === 1) {
      stats.up++
      if (hb.ping !== null && hb.ping > 0) {
        stats.pings.push(hb.ping)
      }
    } else if (hb.status === 0) {
      stats.down++
    }
  }

  // Convert to array
  const result: Array<{ date: string; uptime: number; avgPing: number }> = []
  
  for (const [date, stats] of dailyStats) {
    const total = stats.up + stats.down
    const uptime = total > 0 ? (stats.up / total) * 100 : 100
    const avgPing = stats.pings.length > 0 
      ? Math.round(stats.pings.reduce((a, b) => a + b, 0) / stats.pings.length)
      : 0

    result.push({
      date,
      uptime: Math.round(uptime * 100) / 100,
      avgPing
    })
  }

  // Sort by date
  result.sort((a, b) => a.date.localeCompare(b.date))

  return result
}

/**
 * Calculate overall uptime across all monitors for a user
 */
export async function calculateOverallUptime(userId: number, hours: number = 24): Promise<UptimeResult> {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
  
  // Get all active monitors for the user
  const monitors = await prisma.monitor.findMany({
    where: {
      userId,
      active: true
    },
    select: { id: true }
  })

  if (monitors.length === 0) {
    return {
      uptime: 100,
      uptimeMs: 0,
      downtimeMs: 0,
      totalMs: 0,
      avgPing: 0,
      minPing: 0,
      maxPing: 0,
      upCount: 0,
      downCount: 0,
      totalCount: 0
    }
  }

  // Calculate uptime for each monitor and aggregate
  const uptimes = await Promise.all(
    monitors.map(m => calculateUptime(m.id, startTime))
  )

  // Aggregate results
  let totalUptime = 0
  let totalPing = 0
  let pingCount = 0
  let minPing = Infinity
  let maxPing = 0
  let totalUpMs = 0
  let totalDownMs = 0
  let totalUp = 0
  let totalDown = 0
  let totalTotal = 0

  for (const u of uptimes) {
    totalUptime += u.uptime
    totalUpMs += u.uptimeMs
    totalDownMs += u.downtimeMs
    totalUp += u.upCount
    totalDown += u.downCount
    totalTotal += u.totalCount

    if (u.avgPing > 0) {
      totalPing += u.avgPing
      pingCount++
      minPing = Math.min(minPing, u.minPing)
      maxPing = Math.max(maxPing, u.maxPing)
    }
  }

  return {
    uptime: Math.round((totalUptime / monitors.length) * 100) / 100,
    uptimeMs: totalUpMs,
    downtimeMs: totalDownMs,
    totalMs: totalUpMs + totalDownMs,
    avgPing: pingCount > 0 ? Math.round(totalPing / pingCount) : 0,
    minPing: minPing === Infinity ? 0 : minPing,
    maxPing,
    upCount: totalUp,
    downCount: totalDown,
    totalCount: totalTotal
  }
}

/**
 * Get the current status of all monitors for a user
 */
export async function getMonitorStatusSummary(userId: number): Promise<{
  total: number
  up: number
  down: number
  pending: number
  maintenance: number
  paused: number
}> {
  const monitors = await prisma.monitor.findMany({
    where: { userId },
    select: { 
      id: true, 
      active: true,
      heartbeats: {
        take: 1,
        orderBy: { time: 'desc' },
        select: { status: true }
      }
    }
  })

  let up = 0
  let down = 0
  let pending = 0
  let maintenance = 0
  let paused = 0

  for (const monitor of monitors) {
    if (!monitor.active) {
      paused++
      continue
    }

    const latestHb = monitor.heartbeats[0]
    if (!latestHb) {
      pending++
      continue
    }

    switch (latestHb.status) {
      case 0: down++; break
      case 1: up++; break
      case 2: pending++; break
      case 3: maintenance++; break
      default: pending++
    }
  }

  return {
    total: monitors.length,
    up,
    down,
    pending,
    maintenance,
    paused
  }
}

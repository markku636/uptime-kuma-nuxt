import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Status page slug is required'
    })
  }

  // Get status page
  const statusPage = await prisma.statusPage.findUnique({
    where: { slug },
    include: {
      groups: {
        include: {
          monitors: {
            include: {
              monitor: true
            }
          }
        },
        orderBy: { weight: 'asc' }
      }
    }
  })

  if (!statusPage || !statusPage.published) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Get monitor IDs from all groups
  const monitorIds = statusPage.groups.flatMap(g => 
    g.monitors.map(m => m.monitorId)
  )

  // Get heartbeats for all monitors (last 50 for each)
  const heartbeats = await prisma.heartbeat.findMany({
    where: {
      monitorId: { in: monitorIds }
    },
    orderBy: { time: 'desc' },
    take: monitorIds.length * 50
  })

  // Group heartbeats by monitor ID
  const heartbeatsByMonitor: Record<number, any[]> = {}
  for (const hb of heartbeats) {
    if (!heartbeatsByMonitor[hb.monitorId]) {
      heartbeatsByMonitor[hb.monitorId] = []
    }
    if (heartbeatsByMonitor[hb.monitorId].length < 50) {
      heartbeatsByMonitor[hb.monitorId].push({
        status: hb.status,
        time: hb.time.toISOString(),
        ping: hb.ping,
        msg: hb.msg
      })
    }
  }

  // Calculate uptime for each monitor (last 24h, 7d, 30d)
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const uptimeByMonitor: Record<number, { day: number; week: number; month: number }> = {}

  for (const monitorId of monitorIds) {
    const monitorHeartbeats = heartbeats.filter(h => h.monitorId === monitorId)
    
    const calculateUptime = (since: Date) => {
      const relevantHbs = monitorHeartbeats.filter(h => h.time >= since)
      if (relevantHbs.length === 0) return 100
      const upCount = relevantHbs.filter(h => h.status === 1).length
      return Math.round((upCount / relevantHbs.length) * 10000) / 100
    }

    uptimeByMonitor[monitorId] = {
      day: calculateUptime(oneDayAgo),
      week: calculateUptime(sevenDaysAgo),
      month: calculateUptime(thirtyDaysAgo)
    }
  }

  return {
    heartbeats: heartbeatsByMonitor,
    uptime: uptimeByMonitor,
    timestamp: new Date().toISOString()
  }
})

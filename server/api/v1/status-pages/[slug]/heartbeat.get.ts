// server/api/v1/status-pages/[slug]/heartbeat.get.ts
import { prisma } from '~/server/utils/prisma'

/**
 * Get heartbeat data for a public status page
 * This endpoint is public (no auth required)
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const query = getQuery(event)
  
  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug is required'
    })
  }

  // Find status page
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

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Check if published
  if (!statusPage.published) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Get monitor IDs from query or from status page
  let monitorIds: number[] = []
  
  if (query.monitorIds) {
    // Parse comma-separated monitor IDs
    monitorIds = String(query.monitorIds)
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id))
  } else {
    // Get all monitor IDs from status page groups
    for (const group of statusPage.groups) {
      for (const spm of group.monitors) {
        monitorIds.push(spm.monitorId)
      }
    }
  }

  // Validate that requested monitors belong to this status page
  const validMonitorIds = new Set<number>()
  for (const group of statusPage.groups) {
    for (const spm of group.monitors) {
      validMonitorIds.add(spm.monitorId)
    }
  }
  
  monitorIds = monitorIds.filter(id => validMonitorIds.has(id))

  if (monitorIds.length === 0) {
    return {
      ok: true,
      data: {
        heartbeatList: {},
        uptimeList: {}
      }
    }
  }

  // Fetch heartbeats for each monitor (last 100)
  const heartbeatList: Record<number, any[]> = {}
  const uptimeList: Record<string, number> = {}

  for (const monitorId of monitorIds) {
    // Get last 100 heartbeats
    const heartbeats = await prisma.heartbeat.findMany({
      where: { monitorId },
      orderBy: { time: 'desc' },
      take: 100,
      select: {
        status: true,
        time: true,
        ping: true,
        msg: true
      }
    })

    // Reverse to chronological order
    heartbeatList[monitorId] = heartbeats.reverse().map(hb => ({
      status: hb.status,
      time: hb.time.toISOString(),
      ping: hb.ping,
      msg: hb.msg
    }))

    // Calculate 24-hour uptime
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const recentHeartbeats = await prisma.heartbeat.findMany({
      where: {
        monitorId,
        time: { gte: dayAgo }
      },
      select: { status: true }
    })

    if (recentHeartbeats.length > 0) {
      const upCount = recentHeartbeats.filter(hb => hb.status === 1).length
      uptimeList[`${monitorId}_24`] = upCount / recentHeartbeats.length
    } else {
      uptimeList[`${monitorId}_24`] = 0
    }
  }

  return {
    ok: true,
    data: {
      heartbeatList,
      uptimeList
    }
  }
})

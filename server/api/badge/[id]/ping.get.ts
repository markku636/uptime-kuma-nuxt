import {parseBadgeId,parseBadgeQuery,parseBadgeDuration} from '../../../utils/badge-input'
// server/api/badge/[id]/ping.get.ts
import { generateBadge, getPingColor } from '../../../services/badge/generator'

export default defineEventHandler(async (event) => {
  const id = parseBadgeId(getRouterParam(event, 'id'))
  await assertPublishedMonitor(id)
  const query = parseBadgeQuery(getQuery(event))
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Get monitor with latest heartbeat
  const monitor = await prisma.monitor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      heartbeats: {
        take: 1,
        orderBy: { time: 'desc' },
        select: { ping: true, status: true }
      }
    }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Get ping value
  let pingValue = 0
  let message = 'N/A'

  if (monitor.heartbeats.length > 0 && monitor.heartbeats[0].status === 1) {
    pingValue = monitor.heartbeats[0].ping || 0
    message = `${pingValue}ms`
  }

  // Generate badge
  const label = (query.label ?? 'Response Time')
  const style = (query.style ?? 'flat')
  const labelColor = (query.labelColor ?? '#555')
  const color = query.color ? query.color : getPingColor(pingValue)

  const svg = generateBadge({
    label,
    message,
    labelColor,
    color,
    style
  })

  // Set headers for SVG response
  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
  
  return svg
})

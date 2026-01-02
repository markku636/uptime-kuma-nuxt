// server/api/badge/[id]/avg-response/[duration].get.ts
import { generateBadge } from '../../../../services/badge/generator'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  const duration = getRouterParam(event, 'duration') || '24h'

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Get monitor
  const monitor = await prisma.monitor.findUnique({
    where: { id }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Calculate time range
  let hours = 24
  if (duration === '7d') hours = 168
  else if (duration === '30d') hours = 720
  else if (duration === '1y') hours = 8760

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  // Get heartbeats with ping data
  const heartbeats = await prisma.heartbeat.findMany({
    where: {
      monitorId: id,
      time: { gte: since },
      ping: { not: null }
    },
    select: { ping: true }
  })

  // Calculate average response time
  let avgResponse = 0
  if (heartbeats.length > 0) {
    const sum = heartbeats.reduce((acc, hb) => acc + (hb.ping || 0), 0)
    avgResponse = Math.round(sum / heartbeats.length)
  }

  // Determine color based on response time
  let color = '#2ecc71' // Green - good
  if (avgResponse > 500) color = '#f1c40f' // Yellow - warning
  if (avgResponse > 1000) color = '#e67e22' // Orange - slow
  if (avgResponse > 2000) color = '#e74c3c' // Red - very slow

  const svg = generateBadge(`Avg Response`, `${avgResponse}ms`, color)

  setResponseHeader(event, 'Content-Type', 'image/svg+xml')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
  
  return svg
})

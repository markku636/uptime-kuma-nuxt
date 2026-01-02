// server/api/badge/[id]/status.get.ts
import { generateBadge, getStatusColor } from '../../../services/badge/generator'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '0')
  const query = getQuery(event)
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Get monitor
  const monitor = await prisma.monitor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      heartbeats: {
        take: 1,
        orderBy: { time: 'desc' },
        select: { status: true }
      }
    }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Determine status
  let status: 'up' | 'down' | 'pending' | 'maintenance' = 'pending'
  let statusText = 'Pending'

  if (!monitor.active) {
    status = 'maintenance'
    statusText = 'Paused'
  } else if (monitor.heartbeats.length > 0) {
    const hbStatus = monitor.heartbeats[0].status
    switch (hbStatus) {
      case 0:
        status = 'down'
        statusText = 'Down'
        break
      case 1:
        status = 'up'
        statusText = 'Up'
        break
      case 2:
        status = 'pending'
        statusText = 'Pending'
        break
      case 3:
        status = 'maintenance'
        statusText = 'Maintenance'
        break
    }
  }

  // Generate badge
  const label = String(query.label || 'Status')
  const style = String(query.style || 'flat') as any
  const labelColor = String(query.labelColor || '#555')
  const upColor = String(query.upColor || '#4c1')
  const downColor = String(query.downColor || '#e05d44')

  const color = status === 'up' ? upColor : status === 'down' ? downColor : getStatusColor(status)

  const svg = generateBadge({
    label,
    message: statusText,
    labelColor,
    color,
    style
  })

  // Set headers for SVG response
  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
  
  return svg
})

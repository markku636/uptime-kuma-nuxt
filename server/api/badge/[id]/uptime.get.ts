// server/api/badge/[id]/uptime.get.ts
import { generateBadge, getUptimeColor } from '../../../services/badge/generator'
import { calculateUptime } from '../../../services/uptime/calculator'

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
    select: { id: true, name: true }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Calculate uptime
  const hours = parseInt(String(query.hours || '24'))
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
  const uptimeResult = await calculateUptime(id, startTime)

  // Format uptime
  const uptimeValue = uptimeResult.uptime.toFixed(2)
  const message = `${uptimeValue}%`

  // Generate badge
  const label = String(query.label || `Uptime (${hours}h)`)
  const style = String(query.style || 'flat') as any
  const labelColor = String(query.labelColor || '#555')
  const color = query.color ? String(query.color) : getUptimeColor(uptimeResult.uptime)

  const svg = generateBadge({
    label,
    message,
    labelColor,
    color,
    style
  })

  // Set headers for SVG response
  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'max-age=300') // Cache for 5 minutes
  
  return svg
})

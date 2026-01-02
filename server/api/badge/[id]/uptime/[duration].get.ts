// server/api/badge/[id]/uptime/[duration].get.ts
import { generateBadge, getUptimeColor } from '../../../../services/badge/generator'
import { calculateUptime } from '../../../../services/uptime/calculator'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '0')
  const durationParam = getRouterParam(event, 'duration') || '24'
  const query = getQuery(event)
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Parse duration (e.g., "24h", "7d", "30d", "720h")
  let hours = 24
  const match = durationParam.match(/^(\d+)(h|d)?$/)
  if (match) {
    const value = parseInt(match[1])
    const unit = match[2] || 'h'
    hours = unit === 'd' ? value * 24 : value
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
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
  const uptimeResult = await calculateUptime(id, startTime)

  // Format uptime
  const uptimeValue = uptimeResult.uptime.toFixed(2)
  const message = `${uptimeValue}%`

  // Format label
  let labelSuffix = `${hours}h`
  if (hours >= 24 && hours % 24 === 0) {
    labelSuffix = `${hours / 24}d`
  }

  // Generate badge
  const label = String(query.label || `Uptime (${labelSuffix})`)
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

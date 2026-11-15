import {parseBadgeId,parseBadgeQuery,parseBadgeDuration} from '../../../utils/badge-input'
// server/api/badge/[id]/uptime.get.ts
import { generateBadge, getUptimeColor } from '../../../services/badge/generator'
import { calculateUptime } from '../../../services/uptime/calculator'

export default defineEventHandler(async (event) => {
  const id = parseBadgeId(getRouterParam(event, 'id'))
  await assertPublishedMonitor(id)
  const query = parseBadgeQuery(getQuery(event),true)
  
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
  const hours = (query.hours ?? 24)
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000)
  const uptimeResult = await calculateUptime(id, startTime, endTime)

  // Format uptime
  const uptimeValue = uptimeResult.uptime?.toFixed(2)??'N/A'
  const message = uptimeResult.uptime===null?'N/A':`${uptimeValue}%`

  // Generate badge
  const label = (query.label ?? `Uptime (${hours}h)`)
  const style = (query.style ?? 'flat')
  const labelColor = (query.labelColor ?? '#555')
  const color = query.color ? query.color : (uptimeResult.uptime===null?'#999':getUptimeColor(uptimeResult.uptime))

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

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Prometheus metrics endpoint
export default defineEventHandler(async (event) => {
  // Check for authentication (optional - can be public)
  const authHeader = event.headers.get('authorization')
  
  // Get all active monitors with their latest heartbeat
  const monitors = await prisma.monitor.findMany({
    where: { active: true },
    include: {
      heartbeats: {
        orderBy: { time: 'desc' },
        take: 1
      }
    }
  })

  // Build Prometheus metrics format
  const lines: string[] = []
  
  // Help and Type declarations
  lines.push('# HELP monitor_status Current status of the monitor (1=UP, 0=DOWN)')
  lines.push('# TYPE monitor_status gauge')
  
  lines.push('# HELP monitor_response_time Response time in milliseconds')
  lines.push('# TYPE monitor_response_time gauge')
  
  lines.push('# HELP monitor_cert_days_remaining SSL certificate days remaining')
  lines.push('# TYPE monitor_cert_days_remaining gauge')

  // Add metrics for each monitor
  for (const monitor of monitors) {
    const lastHeartbeat = monitor.heartbeats[0]
    const sanitizedName = monitor.name.replace(/[^a-zA-Z0-9_]/g, '_')
    const labels = `name="${monitor.name}",type="${monitor.type}",url="${monitor.url || monitor.hostname || ''}"`
    
    // Status metric
    const status = lastHeartbeat?.status === 1 ? 1 : 0
    lines.push(`monitor_status{${labels}} ${status}`)
    
    // Response time metric
    if (lastHeartbeat?.ping) {
      lines.push(`monitor_response_time{${labels}} ${lastHeartbeat.ping}`)
    }
  }

  // Add summary metrics
  const totalMonitors = monitors.length
  const upMonitors = monitors.filter(m => m.heartbeats[0]?.status === 1).length
  const downMonitors = totalMonitors - upMonitors

  lines.push('')
  lines.push('# HELP monitors_total Total number of monitors')
  lines.push('# TYPE monitors_total gauge')
  lines.push(`monitors_total ${totalMonitors}`)
  
  lines.push('# HELP monitors_up Number of monitors currently UP')
  lines.push('# TYPE monitors_up gauge')
  lines.push(`monitors_up ${upMonitors}`)
  
  lines.push('# HELP monitors_down Number of monitors currently DOWN')
  lines.push('# TYPE monitors_down gauge')
  lines.push(`monitors_down ${downMonitors}`)

  // Calculate overall uptime (24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentHeartbeats = await prisma.heartbeat.findMany({
    where: {
      time: { gte: oneDayAgo }
    }
  })
  
  const totalHb = recentHeartbeats.length
  const upHb = recentHeartbeats.filter(h => h.status === 1).length
  const overallUptime = totalHb > 0 ? (upHb / totalHb) * 100 : 100

  lines.push('')
  lines.push('# HELP overall_uptime_24h Overall uptime percentage in last 24 hours')
  lines.push('# TYPE overall_uptime_24h gauge')
  lines.push(`overall_uptime_24h ${overallUptime.toFixed(4)}`)

  // Set content type for Prometheus
  setResponseHeader(event, 'Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  
  return lines.join('\n')
})

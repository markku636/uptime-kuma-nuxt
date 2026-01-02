// API endpoint for Prometheus metrics export
import { defineEventHandler, createError, setHeader } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // Set content type for Prometheus
    setHeader(event, 'Content-Type', 'text/plain; version=0.0.4; charset=utf-8')

    // Fetch all monitors with their latest heartbeats
    const monitors = await prisma.monitor.findMany({
      include: {
        heartbeats: {
          take: 1,
          orderBy: { time: 'desc' }
        }
      }
    })

    // Build Prometheus metrics output
    const lines: string[] = []

    // Monitor status metric
    lines.push('# HELP uptime_kuma_monitor_status Monitor status (1 = up, 0 = down)')
    lines.push('# TYPE uptime_kuma_monitor_status gauge')
    
    for (const monitor of monitors) {
      const status = monitor.heartbeats[0]?.status === 1 ? 1 : 0
      const labels = formatLabels({
        monitor_id: monitor.id.toString(),
        monitor_name: monitor.name,
        monitor_type: monitor.type,
        monitor_url: monitor.url || '',
        monitor_hostname: monitor.hostname || ''
      })
      lines.push(`uptime_kuma_monitor_status${labels} ${status}`)
    }

    // Monitor response time metric
    lines.push('')
    lines.push('# HELP uptime_kuma_monitor_response_time Response time in milliseconds')
    lines.push('# TYPE uptime_kuma_monitor_response_time gauge')
    
    for (const monitor of monitors) {
      const ping = monitor.heartbeats[0]?.ping ?? 0
      const labels = formatLabels({
        monitor_id: monitor.id.toString(),
        monitor_name: monitor.name,
        monitor_type: monitor.type
      })
      lines.push(`uptime_kuma_monitor_response_time${labels} ${ping}`)
    }

    // Monitor active status
    lines.push('')
    lines.push('# HELP uptime_kuma_monitor_active Monitor active status (1 = active, 0 = paused)')
    lines.push('# TYPE uptime_kuma_monitor_active gauge')
    
    for (const monitor of monitors) {
      const active = monitor.active ? 1 : 0
      const labels = formatLabels({
        monitor_id: monitor.id.toString(),
        monitor_name: monitor.name
      })
      lines.push(`uptime_kuma_monitor_active${labels} ${active}`)
    }

    // Calculate and export uptime metrics
    lines.push('')
    lines.push('# HELP uptime_kuma_monitor_uptime_percent Uptime percentage over last 24 hours')
    lines.push('# TYPE uptime_kuma_monitor_uptime_percent gauge')
    
    for (const monitor of monitors) {
      // Fetch 24h heartbeats for uptime calculation
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const heartbeats = await prisma.heartbeat.findMany({
        where: {
          monitorId: monitor.id,
          time: { gte: dayAgo }
        }
      })
      
      const uptime = heartbeats.length > 0
        ? (heartbeats.filter(h => h.status === 1).length / heartbeats.length) * 100
        : 0
      
      const labels = formatLabels({
        monitor_id: monitor.id.toString(),
        monitor_name: monitor.name
      })
      lines.push(`uptime_kuma_monitor_uptime_percent${labels} ${uptime.toFixed(4)}`)
    }

    // Info metric
    lines.push('')
    lines.push('# HELP uptime_kuma_info Uptime Kuma instance info')
    lines.push('# TYPE uptime_kuma_info gauge')
    lines.push(`uptime_kuma_info{version="2.0.0-nuxt"} 1`)

    // Monitor count
    lines.push('')
    lines.push('# HELP uptime_kuma_monitor_count Total number of monitors')
    lines.push('# TYPE uptime_kuma_monitor_count gauge')
    lines.push(`uptime_kuma_monitor_count ${monitors.length}`)

    // Active monitor count
    const activeCount = monitors.filter(m => m.active).length
    lines.push('')
    lines.push('# HELP uptime_kuma_monitor_active_count Number of active monitors')
    lines.push('# TYPE uptime_kuma_monitor_active_count gauge')
    lines.push(`uptime_kuma_monitor_active_count ${activeCount}`)

    // Certificate expiry metrics
    lines.push('')
    lines.push('# HELP uptime_kuma_monitor_cert_days_remaining Days until TLS certificate expires')
    lines.push('# TYPE uptime_kuma_monitor_cert_days_remaining gauge')
    
    for (const monitor of monitors) {
      const tlsInfo = monitor.tlsInfo as any
      if (tlsInfo?.daysRemaining !== undefined) {
        const labels = formatLabels({
          monitor_id: monitor.id.toString(),
          monitor_name: monitor.name,
          monitor_url: monitor.url || ''
        })
        lines.push(`uptime_kuma_monitor_cert_days_remaining${labels} ${tlsInfo.daysRemaining}`)
      }
    }

    // Monitor count by status
    const upCount = monitors.filter(m => m.heartbeats[0]?.status === 1).length
    const downCount = monitors.filter(m => m.heartbeats[0]?.status === 0).length
    const pendingCount = monitors.filter(m => !m.heartbeats[0] || m.heartbeats[0]?.status === 2).length

    lines.push('')
    lines.push('# HELP uptime_kuma_monitors_up Number of monitors currently UP')
    lines.push('# TYPE uptime_kuma_monitors_up gauge')
    lines.push(`uptime_kuma_monitors_up ${upCount}`)

    lines.push('')
    lines.push('# HELP uptime_kuma_monitors_down Number of monitors currently DOWN')
    lines.push('# TYPE uptime_kuma_monitors_down gauge')
    lines.push(`uptime_kuma_monitors_down ${downCount}`)

    lines.push('')
    lines.push('# HELP uptime_kuma_monitors_pending Number of monitors currently PENDING')
    lines.push('# TYPE uptime_kuma_monitors_pending gauge')
    lines.push(`uptime_kuma_monitors_pending ${pendingCount}`)

    return lines.join('\n')
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to generate metrics'
    })
  }
})

function formatLabels(labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
    .join(',')
  return `{${parts}}`
}

function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

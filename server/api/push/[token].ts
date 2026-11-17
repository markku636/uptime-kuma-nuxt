// server/api/push/[token].ts
import { recordHeartbeat } from '../../services/monitor/scheduler'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const query = getQuery(event)

  if (!token) {
    throw createError({
      statusCode: 400,
      message: 'Token is required'
    })
  }

  // Find monitor by push token
  const monitor = await prisma.monitor.findUnique({
    where: { pushToken: token }
  })

  // A token left over from when the monitor was a push monitor is not valid
  if (!monitor || monitor.type !== 'push') {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  if (!monitor.active) {
    return {
      ok: true,
      msg: 'Monitor is paused'
    }
  }

  // status=up (default) | down | pending, as in uptime-kuma
  let status = 1
  if (query.status === 'down') status = 0
  else if (query.status === 'pending') status = 2
  // Upside down: a push saying "up" means the watched thing is down
  if (monitor.upsideDown && status !== 2) status = status === 1 ? 0 : 1

  const msg = String(query.msg ?? 'Push received').slice(0, 1000) || 'Push received'
  // A whole number of ms the column can hold (Infinity / huge values are clamped)
  const rawPing = Number(query.ping)
  const ping = Number.isFinite(rawPing) ? Math.min(2_147_483_647, Math.max(0, Math.round(rawPing))) : 0

  // During maintenance a push is recorded as maintenance (no alerts)
  const { isMonitorUnderMaintenance } = await import('../../services/maintenance/scheduler')
  const underMaintenance = await isMonitorUnderMaintenance(monitor.id)

  // Same path as checked monitors: status changes are important, the
  // dashboard and the parent group are told, notifications are sent
  await recordHeartbeat(monitor, underMaintenance ? { status: 3, ping, msg: 'Under maintenance' } : { status, ping, msg })

  return {
    ok: true,
    msg: 'Heartbeat received'
  }
})

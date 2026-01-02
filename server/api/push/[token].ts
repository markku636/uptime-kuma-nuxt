// server/api/push/[token].ts
import { emitHeartbeat } from '../../services/socket'

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

  if (!monitor) {
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

  // Determine status from query params
  let status = 1 // Default UP
  if (query.status === 'down') {
    status = 0
  } else if (query.status === 'pending') {
    status = 2
  }

  const msg = (query.msg as string) || 'Push received'
  const ping = parseInt(query.ping as string) || 0

  // Create heartbeat
  const heartbeat = await prisma.heartbeat.create({
    data: {
      monitorId: monitor.id,
      status,
      msg,
      ping,
      time: new Date(),
    }
  })

  // Emit to socket
  emitHeartbeat(monitor.id, {
    id: heartbeat.id.toString(),
    status: heartbeat.status,
    time: heartbeat.time.toISOString(),
    msg: heartbeat.msg,
    ping: heartbeat.ping,
  })

  return {
    ok: true,
    msg: 'Heartbeat received'
  }
})

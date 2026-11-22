import { requireRequestSession } from '../../../../../utils/request-session'

const MAX_ROWS = 10_000

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: session.workspaceId, environmentId: session.environmentId },
    select: { id: true, name: true },
  })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })

  const rows = await prisma.heartbeat.findMany({
    where: { monitorId: id },
    orderBy: [{ time: 'desc' }, { id: 'desc' }],
    take: MAX_ROWS,
    select: { time: true, status: true, ping: true, msg: true, checkCode: true },
  })
  const statusText = (status: number) => status === 1 ? 'UP' : status === 0 ? 'DOWN' : status === 3 ? 'MAINTENANCE' : 'PENDING'
  const csv = [
    'time,status,ping_ms,message,code',
    ...rows.map(row => [
      row.time.toISOString(),
      statusText(row.status),
      row.ping ?? '',
      `"${String(row.msg || '').replace(/"/g, '""').slice(0, 200)}"`,
      `"${String(row.checkCode || '').replace(/"/g, '""').slice(0, 64)}"`,
    ].join(',')),
  ].join('\n')

  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', `attachment; filename="monitor-${id}-heartbeats.csv"`)
  return csv
})

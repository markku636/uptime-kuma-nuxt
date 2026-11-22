import { requireRequestSession } from '../../../utils/request-session'
import { uptimeWindows } from '../../../services/uptime/rollup-reader'

const periods = { '24h': 24, '7d': 168, '30d': 720 } as const

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const query = getQuery(event)
  const period = typeof query.period === 'string' && Object.hasOwn(periods, query.period)
    ? query.period as keyof typeof periods
    : '24h'
  const ids = (typeof query.ids === 'string' ? query.ids : '')
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isSafeInteger(value) && value > 0)

  if (!ids.length) return { ok: true, data: {} }
  // Bounded fan-out; clients should request only the monitors on the current page.
  const scoped = ids.slice(0, 100)
  const monitors = await prisma.monitor.findMany({
    where: {
      id: { in: scoped },
      workspaceId: session.workspaceId,
      environmentId: session.environmentId,
    },
    select: { id: true },
  })
  const allowed = monitors.map(monitor => monitor.id)
  if (!allowed.length) return { ok: true, data: {} }

  const end = new Date()
  const start = new Date(end.getTime() - periods[period] * 3_600_000)
  const values = await uptimeWindows(allowed, [{ key: period, start, end }])
  const data: Record<string, number | null> = {}
  for (const id of allowed) data[String(id)] = values.get(`${id}:${period}`)?.uptime ?? null
  return { ok: true, data }
})

import { requireRequestSession } from '../../../utils/request-session'
import { uptimeWindows } from '../../../services/uptime/rollup-reader'

const periods = { '24h': 24, '7d': 168, '30d': 720, '1y': 8760 } as const

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
  const details: Record<string, { uptime: number | null; downtimeMinutes: number; upCount: number; downCount: number; coverage: number }> = {}
  for (const id of allowed) {
    const result = values.get(`${id}:${period}`)
    data[String(id)] = result?.uptime ?? null
    details[String(id)] = {
      uptime: result?.uptime ?? null,
      downtimeMinutes: Math.round((result?.downtimeMs || 0) / 60000),
      upCount: result?.upCount || 0,
      downCount: result?.downCount || 0,
      coverage: result?.coverage || 0,
    }
  }
  return { ok: true, data, details }
})

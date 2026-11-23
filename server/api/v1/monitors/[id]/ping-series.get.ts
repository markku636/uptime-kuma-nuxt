import { Prisma } from '@prisma/client'
import { requireWorkspace } from '../../../../utils/workspace'

const windows = { '24h': 24, '7d': 168, '30d': 720 } as const

/** Server-side bucketed ping averages — bounded to ~60 points, never ships raw history. */
export default defineEventHandler(async (event) => {
  const scope = await requireWorkspace(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const rawPeriod = getQuery(event).period
  const period = typeof rawPeriod === 'string' && Object.hasOwn(windows, rawPeriod)
    ? rawPeriod as keyof typeof windows
    : '24h'
  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true },
  })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })

  const hours = windows[period]
  const points = 60
  const bucketSeconds = Math.max(1, Math.floor(hours * 3600 / points))
  const start = new Date(Date.now() - hours * 3_600_000)
  const rows = await prisma.$queryRaw<Array<{ bucket: bigint | number | string; ping: number | null; count: number; down: number }>>(Prisma.sql`
    SELECT (floor(extract(epoch from time) / ${bucketSeconds})::bigint * ${bucketSeconds}) AS bucket,
           avg(ping)::int AS ping,
           count(*)::int AS count,
           count(*) FILTER (WHERE status = 0)::int AS down
    FROM heartbeats
    WHERE monitor_id = ${id} AND time >= ${start}
    GROUP BY bucket
    ORDER BY bucket ASC`)
  return {
    ok: true,
    period,
    data: rows.map(row => ({
      time: new Date(Number(row.bucket) * 1000).toISOString(),
      ping: Number.isFinite(Number(row.ping)) ? Number(row.ping) : 0,
      count: Number(row.count),
      down: Number(row.down),
    })),
  }
})

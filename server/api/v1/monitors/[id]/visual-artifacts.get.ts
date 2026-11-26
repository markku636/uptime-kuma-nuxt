import { z } from 'zod'
import { parseBoundedQuery } from '../../../../utils/monitor-query'

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(20).default(10) }).strict()

export default defineEventHandler(async (event) => {
  const scope = await requireRequestSession(event)
  const id = parseBoundedQuery(z.coerce.number().int().positive(), getRouterParam(event, 'id'))
  const query = parseBoundedQuery(querySchema, getQuery(event))

  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true, type: true, configVersion: true },
  })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })

  const [rows, baselines] = await Promise.all([
    prisma.visualCheckArtifact.findMany({
      where: { monitorId: id },
      orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    }),
    prisma.visualBaseline.findMany({ where: { monitorId: id } }),
  ])
  const baselineByLabel = new Map(baselines.map((row) => [row.viewportLabel, row]))

  // 回傳的圖片是 base64，一筆可能很大；只回每個 viewport 最近一筆（最多 4 個）。
  const seen = new Set<string>()
  const latestPerViewport = rows.filter((row) => {
    if (seen.has(row.viewportLabel)) return false
    seen.add(row.viewportLabel)
    return true
  })

  return {
    ok: true,
    monitorType: monitor.type,
    configVersion: monitor.configVersion,
    data: latestPerViewport.map((row) => {
      const baseline = baselineByLabel.get(row.viewportLabel)
      return {
        id: String(row.id),
        viewportLabel: row.viewportLabel,
        checkedAt: row.checkedAt,
        status: row.status,
        diffRatio: row.diffRatio,
        diffPixels: row.diffPixels,
        metrics: row.metrics,
        currentImage: row.currentImage ? Buffer.from(row.currentImage).toString('base64') : null,
        diffImage: row.diffImage ? Buffer.from(row.diffImage).toString('base64') : null,
        baseline: baseline
          ? {
              configVersion: baseline.configVersion,
              sha256: baseline.sha256,
              createdAt: baseline.createdAt,
              stale: baseline.configVersion !== monitor.configVersion,
              image: Buffer.from(baseline.image).toString('base64'),
            }
          : null,
      }
    }),
  }
})

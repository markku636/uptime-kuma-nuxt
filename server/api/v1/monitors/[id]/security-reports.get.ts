import { z } from 'zod'
import { redactSecurityReport } from '../../../../services/monitor/checkers/security-scan-checker'

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(20).default(10) }).strict()

export default defineEventHandler(async event => {
  const scope = await requireRequestSession(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) throw createError({ statusCode: 400, message: 'Invalid query' })

  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true },
  })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })

  const rows = await prisma.visualCheckArtifact.findMany({
    where: { monitorId: id, viewportLabel: 'security-report' },
    orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
    take: query.data.limit,
    select: { id: true, checkedAt: true, metrics: true },
  })
  return {
    ok: true,
    data: rows.map(row => {
      let report: any = null
      try {
        if (row.metrics && typeof row.metrics === 'object' && !Array.isArray(row.metrics)) {
          report = redactSecurityReport(row.metrics as any)
        }
      } catch { report = null }
      return {
        id: String(row.id), checkedAt: row.checkedAt,
        score: report?.score ?? null, grade: report?.grade ?? null,
        riskLevel: report?.riskLevel ?? null,
        findingCount: Array.isArray(report?.findings) ? report.findings.length : null,
        report,
      }
    }),
  }
})

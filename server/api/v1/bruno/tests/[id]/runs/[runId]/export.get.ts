import { prisma } from '~/server/utils/prisma'
import { runReport, reportToCsv } from '~/server/services/bruno/test-report'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const id = Number(getRouterParam(event, 'id'))
  const runId = Number(getRouterParam(event, 'runId'))
  const format = String(getQuery(event).format || 'json')
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(runId) || runId < 1 || !['json', 'csv'].includes(format)) {
    throw createError({ statusCode: 400, message: 'Invalid report export request' })
  }
  const run = await prisma.brunoTestRun.findFirst({
    where: { id: runId, suiteId: id, suite: { workspaceId: scope.workspaceId, environmentId: scope.environmentId } },
    include: { steps: { orderBy: { stepIndex: 'asc' }, take: 50 } },
  })
  if (!run) throw createError({ statusCode: 404, message: 'Test run not found' })
  const report = runReport(run, run.steps)
  setResponseHeader(event, 'content-type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8')
  setResponseHeader(event, 'content-disposition', `attachment; filename="bruno-test-${runId}.${format}"`)
  return format === 'csv' ? `\uFEFF${reportToCsv(report)}` : JSON.stringify(report, null, 2)
})

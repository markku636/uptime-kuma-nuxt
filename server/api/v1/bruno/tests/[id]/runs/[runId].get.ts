import { prisma } from '~/server/utils/prisma'
import { runReport } from '~/server/services/bruno/test-report'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const id = Number(getRouterParam(event, 'id'))
  const runId = Number(getRouterParam(event, 'runId'))
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(runId) || runId < 1) {
    throw createError({ statusCode: 400, message: 'Invalid test run id' })
  }
  const run = await prisma.brunoTestRun.findFirst({
    where: { id: runId, suiteId: id, suite: { workspaceId: scope.workspaceId, environmentId: scope.environmentId } },
    include: { steps: { orderBy: { stepIndex: 'asc' }, take: 50 } },
  })
  if (!run) throw createError({ statusCode: 404, message: 'Test run not found' })
  return { ok: true, data: runReport(run, run.steps) }
})

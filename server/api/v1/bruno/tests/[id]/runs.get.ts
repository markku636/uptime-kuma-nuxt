import { prisma } from '~/server/utils/prisma'
import { runReport } from '~/server/services/bruno/test-report'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid test suite id' })
  const suite = await prisma.brunoTestSuite.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true },
  })
  if (!suite) throw createError({ statusCode: 404, message: 'Bruno test suite not found' })
  const rows = await prisma.brunoTestRun.findMany({ where: { suiteId: id }, orderBy: { id: 'desc' }, take: 100 })
  return { ok: true, data: rows.map(row => ({ ...runReport(row), steps: undefined })) }
})

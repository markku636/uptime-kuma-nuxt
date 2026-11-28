import { prisma } from '~/server/utils/prisma'
import { suiteDTO } from '~/server/services/bruno/test-definition'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid test suite id' })
  const row = await prisma.brunoTestSuite.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
  })
  if (!row) throw createError({ statusCode: 404, message: 'Bruno test suite not found' })
  const definition = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
  const canEditSource = event.context.authMethod === 'session' && ['owner', 'editor'].includes((scope as any).role)
  return { ok: true, data: { ...suiteDTO(row), steps: definition?.steps?.map((step: any) => ({
    path: step.path, name: step.name, method: step.method, extract: step.extract || [],
    ...(canEditSource ? { source: step.source || '' } : {}),
  })) || [] } }
})

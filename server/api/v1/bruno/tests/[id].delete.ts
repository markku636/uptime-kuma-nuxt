import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid test suite id' })
  const row = await prisma.brunoTestSuite.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true },
  })
  if (!row) throw createError({ statusCode: 404, message: 'Bruno test suite not found' })
  await prisma.brunoTestSuite.delete({ where: { id } })
  return { ok: true }
})

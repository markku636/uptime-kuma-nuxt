import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid rule id' })
  const existing = await prisma.securityRule.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!existing) throw createError({ statusCode: 404, message: 'Rule not found' })
  await prisma.securityRule.delete({ where: { id } })
  return { ok: true }
})

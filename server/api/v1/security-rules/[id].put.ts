import { prisma } from '~/server/utils/prisma'
import { securityRuleSchema, toRuleRow } from '~/server/utils/security-rule-input'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid rule id' })
  const existing = await prisma.securityRule.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!existing) throw createError({ statusCode: 404, message: 'Rule not found' })
  const parsed = securityRuleSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid rule' })
  const row = await prisma.securityRule.update({ where: { id }, data: toRuleRow(parsed.data, scope.workspaceId) })
  return { ok: true, data: row }
})

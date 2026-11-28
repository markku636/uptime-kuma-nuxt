import { prisma } from '~/server/utils/prisma'
import { securityRuleSchema, toRuleRow } from '~/server/utils/security-rule-input'
import catalog from '~/server/services/security-scan/catalog.json'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = securityRuleSchema.array().safeParse(catalog)
  if (!parsed.success) throw createError({ statusCode: 500, message: 'Built-in catalog is invalid' })
  let created = 0, updated = 0
  for (const rule of parsed.data) {
    const row = toRuleRow(rule, scope.workspaceId)
    const existing = await prisma.securityRule.findUnique({ where: { workspaceId_key: { workspaceId: scope.workspaceId, key: rule.key } }, select: { id: true } })
    if (existing) { await prisma.securityRule.update({ where: { id: existing.id }, data: row }); updated++ }
    else { await prisma.securityRule.create({ data: row }); created++ }
  }
  return { ok: true, created, updated, total: parsed.data.length }
})

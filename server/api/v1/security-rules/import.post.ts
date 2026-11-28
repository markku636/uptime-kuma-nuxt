import { prisma } from '~/server/utils/prisma'
import { securityRuleSchema, toRuleRow } from '~/server/utils/security-rule-input'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const body = await readBody(event)
  if (!Array.isArray(body?.rules) || body.rules.length > 300) {
    throw createError({ statusCode: 400, message: 'Provide up to 300 rules' })
  }
  const parsed = securityRuleSchema.array().safeParse(body.rules)
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid rules' })
  const data = parsed.data.map(rule => toRuleRow(rule, scope.workspaceId))
  const result = await prisma.securityRule.createMany({ data, skipDuplicates: true })
  return { ok: true, imported: result.count, skipped: data.length - result.count }
})

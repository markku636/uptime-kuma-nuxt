import { prisma } from '~/server/utils/prisma'
import { securityRuleSchema, toRuleRow } from '~/server/utils/security-rule-input'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = securityRuleSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid rule' })
  try {
    const row = await prisma.securityRule.create({ data: toRuleRow(parsed.data, scope.workspaceId) })
    return { ok: true, data: row }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, message: 'Rule key already exists' })
    throw error
  }
})

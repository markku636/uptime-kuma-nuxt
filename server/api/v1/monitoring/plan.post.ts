import { prisma } from '../../../utils/prisma'
import { requireWorkspace } from '../../../utils/workspace'
import { declarativeDocumentSchema, exportDeclarative, planDeclarative } from '../../../services/monitoring-as-code'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = declarativeDocumentSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid declarative document' })
  const current = await exportDeclarative(scope, prisma)
  const plan = planDeclarative(current, parsed.data)
  return { ok: true, data: { plan, current, desired: parsed.data } }
})

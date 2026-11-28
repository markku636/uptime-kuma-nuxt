import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireWorkspace } from '../../../utils/workspace'
import { declarativeDocumentSchema, applyDeclarative } from '../../../services/monitoring-as-code'
import { stopMonitorJob } from '../../../services/monitor/scheduler'

const bodySchema = z.object({
  document: declarativeDocumentSchema,
  activate: z.boolean().default(false),
}).strict()

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid document' })
  try {
    const result = await applyDeclarative(scope, parsed.data.document, { activate: parsed.data.activate }, prisma)
    const ids = await prisma.monitor.findMany({ where: {
      workspaceId: scope.workspaceId, environmentId: scope.environmentId,
      name: { in: [...result.created, ...result.updated] },
    }, select: { id: true } })
    for (const row of ids) stopMonitorJob(row.id)
    return { ok: true, data: result }
  } catch (error: any) {
    throw createError({ statusCode: 400, message: String(error?.message || error).slice(0, 500) })
  }
})

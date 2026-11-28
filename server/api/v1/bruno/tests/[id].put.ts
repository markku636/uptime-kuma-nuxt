import { prisma } from '~/server/utils/prisma'
import { brunoTestUpdateSchema } from '~/server/utils/bruno-test-input'
import { suiteDTO, validateExtractionRules } from '~/server/services/bruno/test-definition'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid test suite id' })
  const row = await prisma.brunoTestSuite.findFirst({ where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId } })
  if (!row) throw createError({ statusCode: 404, message: 'Bruno test suite not found' })
  const parsed = brunoTestUpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid update' })
  const body = parsed.data
  const definition = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
  if (body.name) definition.name = body.name
  if (body.failFast !== undefined) definition.failFast = body.failFast
  if (body.timeoutSec !== undefined) definition.timeoutSec = body.timeoutSec
  if (body.stepExtract) {
    try {
      for (const step of definition.steps || []) {
        if (body.stepExtract[step.path]) step.extract = validateExtractionRules(body.stepExtract[step.path])
      }
    } catch {
      throw createError({ statusCode: 400, message: 'Unsupported extraction rule' })
    }
  }
  try {
    const updated = await prisma.brunoTestSuite.update({
      where: { id },
      data: { ...(body.name ? { name: body.name } : {}), definition,
      ...(body.scheduleIntervalSec !== undefined ? {
        scheduleIntervalSec: body.scheduleIntervalSec || null,
        nextRunAt: body.scheduleIntervalSec ? new Date(Date.now() + body.scheduleIntervalSec * 1000) : null,
      } : {}) },
    })
    return { ok: true, data: suiteDTO(updated) }
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, message: 'A test suite with this name already exists' })
    throw error
  }
})

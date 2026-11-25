import { z } from 'zod'
import type { BrunoRequestModel } from '../../../../../shared/types/bruno'
import { editorEnvironmentValues, modelToSource } from '../../../../services/bruno/request-editor'

const payload = z.object({
  model: z.unknown(),
  environmentId: z.number().int().positive().optional(),
}).strict()

/** Serialize one UI model to official .bru text. Model validation failures come back as safe issues. */
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = payload.safeParse(await readBody(event))
  if (!parsed.success || !parsed.data.model || typeof parsed.data.model !== 'object' || Array.isArray(parsed.data.model)) {
    throw createError({ statusCode: 400, message: 'A request model is required' })
  }

  const environmentId = parsed.data.environmentId ?? scope.environmentId
  if (parsed.data.environmentId !== undefined) {
    const environment = await prisma.environment.findFirst({
      where: { id: parsed.data.environmentId, workspaceId: scope.workspaceId }, select: { id: true },
    })
    if (!environment) throw createError({ statusCode: 404, message: 'Environment not found' })
  }

  try {
    const { values, secretNames } = await editorEnvironmentValues(scope.workspaceId, environmentId)
    return { ok: true, data: await modelToSource(parsed.data.model as BrunoRequestModel, values, secretNames) }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, message: 'Unable to serialize request model' })
  }
})

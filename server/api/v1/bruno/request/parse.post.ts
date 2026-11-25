import { z } from 'zod'
import { editorEnvironmentValues, sourceToModel } from '../../../../services/bruno/request-editor'

const payload = z.object({
  source: z.string().max(131072),
  environmentId: z.number().int().positive().optional(),
}).strict()

/** Parse one declarative .bru request for the UI editor. Invalid Bruno is a normal result, not an HTTP error. */
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = payload.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'A .bru source string is required' })

  const environmentId = parsed.data.environmentId ?? scope.environmentId
  if (parsed.data.environmentId !== undefined) {
    const environment = await prisma.environment.findFirst({
      where: { id: parsed.data.environmentId, workspaceId: scope.workspaceId }, select: { id: true },
    })
    if (!environment) throw createError({ statusCode: 404, message: 'Environment not found' })
  }

  try {
    const { values, secretNames } = await editorEnvironmentValues(scope.workspaceId, environmentId)
    return { ok: true, data: await sourceToModel(parsed.data.source, values, secretNames) }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, message: 'Unable to parse request source' })
  }
})

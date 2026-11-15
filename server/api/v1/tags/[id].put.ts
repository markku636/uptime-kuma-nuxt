import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
}).strict().refine(value => Object.keys(value).length > 0)

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const rawId = getRouterParam(event, 'id') || ''
  const id = Number(rawId)
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id)) {
    throw createError({ statusCode: 400, message: 'Invalid tag ID' })
  }
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Provide a valid tag name or #RRGGBB color only' })
  try {
    const tag = await prisma.tag.update({
      where: { id, workspaceId: scope.workspaceId },
      data: parsed.data,
      select: { id: true, name: true, color: true, workspaceId: true }
    })
    return { ok: true, data: tag }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      throw createError({ statusCode: 404, message: 'Tag not found' })
    }
    throw error
  }
})

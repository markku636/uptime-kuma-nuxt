// server/api/v1/tags/[id].put.ts
// Rename / recolour a tag (Settings > Tags called this route, which did not exist)
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid tag ID' })

  const body = await readBody(event)
  const data: { name?: string; color?: string } = {}
  if (body?.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) throw createError({ statusCode: 400, message: 'Name is required' })
    data.name = body.name.trim().slice(0, 100)
  }
  if (body?.color !== undefined) {
    if (typeof body.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      throw createError({ statusCode: 400, message: 'Invalid color format (must be #RRGGBB)' })
    }
    data.color = body.color
  }

  const updated = await prisma.tag.updateMany({ where: { id, userId: session.user.id }, data })
  if (!updated.count) throw createError({ statusCode: 404, message: 'Tag not found' })

  return { ok: true, data: await prisma.tag.findUnique({ where: { id } }) }
})

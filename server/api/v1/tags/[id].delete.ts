// server/api/v1/tags/[id].delete.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '')
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid tag ID'
    })
  }

  if (!await prisma.tag.findFirst({ where: { id, workspaceId: session.workspaceId } })) throw createError({ statusCode: 404, message: 'Tag not found' })
  await prisma.tag.delete({
    where: { id, workspaceId: session.workspaceId }
  })

  return {
    ok: true,
    message: 'Tag deleted successfully'
  }
})

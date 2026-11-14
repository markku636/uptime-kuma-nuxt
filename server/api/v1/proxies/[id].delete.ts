import { prisma } from '~/server/utils/prisma'


export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid proxy ID'
    })
  }

  // Verify ownership
  const existing = await prisma.proxy.findFirst({
    where: { id, workspaceId: session.workspaceId }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Proxy not found'
    })
  }

  await prisma.proxy.delete({
    where: { id, workspaceId: session.workspaceId }
  })

  return { success: true }
})

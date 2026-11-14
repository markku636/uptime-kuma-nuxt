import { prisma } from '~/server/utils/prisma'


export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Docker host ID'
    })
  }

  // Verify ownership
  const existing = await prisma.dockerHost.findFirst({
    where: { id, workspaceId: session.workspaceId }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Docker host not found'
    })
  }

  await prisma.dockerHost.delete({
    where: { id, workspaceId: session.workspaceId }
  })

  return { success: true }
})

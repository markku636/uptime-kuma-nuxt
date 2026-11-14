import { prisma } from '~/server/utils/prisma'


export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Status page slug is required'
    })
  }

  // Verify ownership
  const statusPage = await prisma.statusPage.findFirst({
    where: { slug, workspaceId: session.workspaceId }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Delete the status page
  await prisma.statusPage.delete({
    where: { id: statusPage.id, workspaceId: session.workspaceId }
  })

  return { success: true }
})

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Status page slug is required'
    })
  }

  // Verify ownership
  const statusPage = await prisma.statusPage.findFirst({
    where: {
      slug,
      userId: session.user.id
    }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Delete the status page
  await prisma.statusPage.delete({
    where: { id: statusPage.id }
  })

  return { success: true }
})

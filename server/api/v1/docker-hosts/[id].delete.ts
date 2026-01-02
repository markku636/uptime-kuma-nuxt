import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Docker host ID'
    })
  }

  // Verify ownership
  const existing = await prisma.dockerHost.findFirst({
    where: {
      id,
      userId: session.user.id
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Docker host not found'
    })
  }

  await prisma.dockerHost.delete({
    where: { id }
  })

  return { success: true }
})

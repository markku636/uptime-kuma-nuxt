import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid proxy ID'
    })
  }

  // Verify ownership
  const existing = await prisma.proxy.findFirst({
    where: {
      id,
      userId: session.user.id
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Proxy not found'
    })
  }

  await prisma.proxy.delete({
    where: { id }
  })

  return { success: true }
})

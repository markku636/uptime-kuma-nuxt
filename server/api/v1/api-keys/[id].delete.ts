// server/api/v1/api-keys/[id].delete.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'API key ID is required'
    })
  }

  // Verify ownership
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: Number(id),
      userId: session.user.id
    }
  })

  if (!apiKey) {
    throw createError({
      statusCode: 404,
      message: 'API key not found'
    })
  }

  await prisma.apiKey.delete({
    where: { id: Number(id) }
  })

  return { success: true }
})

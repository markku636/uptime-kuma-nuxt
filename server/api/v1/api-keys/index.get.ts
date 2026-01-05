// server/api/v1/api-keys/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId: session.user.id
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      expires: true,
      active: true
      // Don't return the actual key value
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return apiKeys
})

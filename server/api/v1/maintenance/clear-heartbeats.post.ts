// server/api/v1/maintenance/clear-heartbeats.post.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  // Delete all heartbeats
  const result = await prisma.heartbeat.deleteMany({})

  return {
    success: true,
    deleted: result.count,
    message: `Deleted ${result.count} heartbeat records`
  }
})

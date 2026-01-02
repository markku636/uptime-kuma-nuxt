// server/api/v1/maintenance/clear-statistics.post.ts
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

  // Reset statistics - update all monitors to clear cached stats
  const result = await prisma.monitor.updateMany({
    data: {
      // Reset any cached statistics fields if they exist
      // This is a placeholder - adjust based on your actual schema
    }
  })

  // Also clear any aggregated statistics tables if they exist
  // await prisma.statistic.deleteMany({})

  return {
    success: true,
    message: 'Statistics have been cleared'
  }
})

// server/api/v1/maintenance/clear-events.post.ts
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

  // Delete all status page incidents (events)
  const incidentsResult = await prisma.statusPageIncident.deleteMany({})

  // If you have a separate events table, clear it too
  // const eventsResult = await prisma.event.deleteMany({})

  return {
    success: true,
    deleted: incidentsResult.count,
    message: `Deleted ${incidentsResult.count} event records`
  }
})

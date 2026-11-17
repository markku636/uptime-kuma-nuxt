// server/api/v1/database/clear-statistics.post.ts
// Uptime statistics are computed from heartbeats (there are no separate
// aggregate tables), so clearing them deletes the user's heartbeats, as
// "Clear Statistics" does in uptime-kuma.
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const result = await prisma.heartbeat.deleteMany({
    where: { monitor: { userId } },
  })

  return {
    success: true,
    deleted: result.count,
    message: `Statistics cleared (${result.count} heartbeats deleted)`,
  }
})

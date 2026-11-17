// server/api/v1/monitor-history/clear-all.post.ts
// Delete all of the user's heartbeats.
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const result = await prisma.heartbeat.deleteMany({ where: { monitor: { userId } } })
  return { ok: true, deleted: result.count }
})

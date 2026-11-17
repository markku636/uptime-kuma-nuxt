// server/api/v1/monitor-history/clear.post.ts
// Delete the user's heartbeats older than `days` days.
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { HISTORY_MAX_DAYS } from '~/server/services/monitor/history'

const schema = z.object({ days: z.number().int().min(1).max(HISTORY_MAX_DAYS) })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0].message })

  const cutoff = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000)
  const result = await prisma.heartbeat.deleteMany({ where: { monitor: { userId }, time: { lt: cutoff } } })
  return { ok: true, deleted: result.count }
})

// server/api/v1/monitor-history/settings.get.ts
// How long heartbeats are kept (the nightly clear-old-data job), plus how
// much history there is now.
import { prisma } from '~/server/utils/prisma'
import { HISTORY_DEFAULT_DAYS } from '~/server/services/monitor/history'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const setting = await prisma.setting.findUnique({ where: { key: 'keepDataPeriodDays' } })
  const parsed = Number.parseInt(setting?.value ?? '', 10)
  const where = { monitor: { userId } }
  const [count, oldest] = await Promise.all([
    prisma.heartbeat.count({ where }),
    prisma.heartbeat.findFirst({ where, orderBy: { time: 'asc' }, select: { time: true } }),
  ])
  return {
    keepDataPeriodDays: Number.isNaN(parsed) ? HISTORY_DEFAULT_DAYS : parsed,
    heartbeatCount: count,
    oldest: oldest?.time ?? null,
  }
})

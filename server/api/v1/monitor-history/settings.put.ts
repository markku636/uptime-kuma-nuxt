// server/api/v1/monitor-history/settings.put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { HISTORY_MAX_DAYS } from '~/server/services/monitor/history'

const schema = z.object({
  // 0 keeps history forever
  keepDataPeriodDays: z.number().int().min(0).max(HISTORY_MAX_DAYS),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!(session?.user as any)?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0].message })

  const value = String(parsed.data.keepDataPeriodDays)
  await prisma.setting.upsert({
    where: { key: 'keepDataPeriodDays' },
    create: { key: 'keepDataPeriodDays', value },
    update: { value },
  })
  return { ok: true, keepDataPeriodDays: parsed.data.keepDataPeriodDays }
})

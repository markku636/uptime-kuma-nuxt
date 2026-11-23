// server/api/v1/settings/tls-expiry.put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { TLS_EXPIRY_SETTING_KEY, parseTlsExpiryDays } from '../../../utils/tls-expiry-settings'

const schema = z.object({
  days: z.array(z.number().min(1))
})

export default defineEventHandler(async (event) => {
  await requireRequestSession(event)
  const body = await readValidatedBody(event, schema.parse)
  const days = parseTlsExpiryDays(body.days)
  const value = JSON.stringify(days)

  await prisma.setting.upsert({
    where: { key: TLS_EXPIRY_SETTING_KEY },
    update: { value, type: 'json' },
    create: { key: TLS_EXPIRY_SETTING_KEY, value, type: 'json' }
  })

  return { success: true, days }
})

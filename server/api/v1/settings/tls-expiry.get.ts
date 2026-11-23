// server/api/v1/settings/tls-expiry.get.ts
import { prisma } from '~/server/utils/prisma'
import { TLS_EXPIRY_SETTING_KEY, parseTlsExpiryDays } from '../../../utils/tls-expiry-settings'

export default defineEventHandler(async (event) => {
  await requireRequestSession(event)
  const setting = await prisma.setting.findUnique({
    where: { key: TLS_EXPIRY_SETTING_KEY }
  })
  return { days: parseTlsExpiryDays(setting?.value) }
})

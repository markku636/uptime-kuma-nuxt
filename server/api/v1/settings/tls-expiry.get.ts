// server/api/v1/settings/tls-expiry.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const setting = await prisma.setting.findUnique({
    where: { key: 'tlsExpiryDays' }
  })

  if (setting?.value) {
    try {
      return { days: JSON.parse(setting.value) }
    } catch {
      return { days: [7, 14, 21] }
    }
  }

  return { days: [7, 14, 21] }
})

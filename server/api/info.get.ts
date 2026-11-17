// server/api/info.get.ts
// Server facts for Settings > About (logged-in users only).
import os from 'node:os'
import { prisma } from '~/server/utils/prisma'

const APP_VERSION = '2.0.0-nuxt'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!(session?.user as any)?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const tz = await prisma.setting.findUnique({ where: { key: 'serverTimezone' } }).catch(() => null)
  return {
    version: APP_VERSION,
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    uptimeSeconds: Math.round(process.uptime()),
    serverTimezone: tz?.value || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    primaryHostname: os.hostname(),
  }
})

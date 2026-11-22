import os from 'node:os'
import { existsSync } from 'node:fs'
import { APP_VERSION } from '../utils/version'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const config = useRuntimeConfig(event)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const offsetMinutes = -new Date().getTimezoneOffset()
  const pad = (value: number) => String(value).padStart(2, '0')
  const offset = `UTC${offsetMinutes >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`
  return {
    version: APP_VERSION,
    frontendVersion: APP_VERSION,
    appUrl: config.public.appUrl,
    latency: 0,
    primaryHostname: os.hostname(),
    serverTimezone: timezone,
    serverTimezoneOffset: offset,
    isContainer: existsSync('/.dockerenv') || !!process.env.KUBERNETES_SERVICE_HOST,
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    uptimeSeconds: Math.round(process.uptime()),
    user: { id: session.user.id, username: session.user.username },
  }
})

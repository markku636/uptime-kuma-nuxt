import os from 'node:os'
import { APP_VERSION } from '../utils/version'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const config = useRuntimeConfig(event)
  return {
    version: APP_VERSION,
    frontendVersion: APP_VERSION,
    appUrl: config.public.appUrl,
    latency: 0,
    primaryHostname: os.hostname(),
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    uptimeSeconds: Math.round(process.uptime()),
    user: { id: session.user.id, username: session.user.username },
  }
})

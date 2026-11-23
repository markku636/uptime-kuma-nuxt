// server/api/settings/general.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)

  // Get general settings from database
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'displayTimezone',
          'serverTimezone',
          'searchEngineIndex',
          'entryPage',
          'primaryBaseUrl',
          'steamApiKey',
          'chromePath',
          'dnsServers',
          'trustProxy',
          'nscd',
          'keepDataPeriodDays',
          'checkUpdate',
          'checkBeta',
          'showRuntimeHints',
          'statusPageSlug'
        ]
      }
    }
  })

  // Convert to key-value object with defaults
  const settingsMap: Record<string, any> = {
    displayTimezone: 'auto',
    serverTimezone: 'UTC',
    searchEngineIndex: true,
    entryPage: 'dashboard',
    primaryBaseUrl: '',
    steamApiKey: '',
    chromePath: '',
    dnsServers: '8.8.8.8\n1.1.1.1',
    trustProxy: false,
    nscd: true,
    keepDataPeriodDays: 180,
    checkUpdate: true,
    checkBeta: false,
    showRuntimeHints: true,
    statusPageSlug: ''
  }

  settings.forEach(setting => {
    if (setting.type === 'boolean') {
      settingsMap[setting.key] = setting.value === 'true'
    } else if (setting.type === 'number') {
      settingsMap[setting.key] = Number(setting.value) || settingsMap[setting.key]
    } else {
      settingsMap[setting.key] = setting.value ?? settingsMap[setting.key]
    }
  })

  return settingsMap
})

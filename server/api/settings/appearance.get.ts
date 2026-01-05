// server/api/settings/appearance.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  // Get appearance settings from database
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'theme',
          'primaryColor',
          'uptimeDisplayStyle',
          'heartbeatBarStyle',
          'elapsedTimeStyle',
          'showCertificateExpiry'
        ]
      }
    }
  })

  // Convert to key-value object with defaults
  const settingsMap: Record<string, string | boolean> = {
    theme: 'auto',
    primaryColor: 'green',
    uptimeDisplayStyle: 'percentage',
    heartbeatBarStyle: 'normal',
    elapsedTimeStyle: 'no-line',
    showCertificateExpiry: true
  }

  settings.forEach(setting => {
    if (setting.type === 'boolean') {
      settingsMap[setting.key] = setting.value === 'true'
    } else {
      settingsMap[setting.key] = setting.value || settingsMap[setting.key]
    }
  })

  return settingsMap
})

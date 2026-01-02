// server/services/notification/providers/teams.ts
import type { NotificationMessage } from '../sender'

export const teamsProvider = {
  async send(config: { webhookUrl: string }, message: NotificationMessage) {
    if (!config.webhookUrl) {
      throw new Error('Microsoft Teams webhook URL is required')
    }

    const themeColor = message.status === 'up' ? '2ecc71' : 'e74c3c'

    // Adaptive Card format for modern Teams webhooks
    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor,
      summary: message.title,
      sections: [{
        activityTitle: message.title,
        facts: [
          {
            name: 'Monitor',
            value: message.monitorName
          },
          {
            name: 'Status',
            value: message.status === 'up' ? '✅ UP' : '❌ DOWN'
          },
          {
            name: 'Response Time',
            value: `${message.ping}ms`
          },
          ...(message.monitorUrl ? [{
            name: 'URL',
            value: message.monitorUrl
          }] : [])
        ],
        markdown: true
      }],
      potentialAction: message.monitorUrl ? [{
        '@type': 'OpenUri',
        name: 'View Monitor',
        targets: [{
          os: 'default',
          uri: message.monitorUrl
        }]
      }] : []
    }

    await $fetch(config.webhookUrl, {
      method: 'POST',
      body: card
    })
  }
}

// server/services/notification/providers/discord.ts
import type { NotificationMessage } from '../sender'

export const discordProvider = {
  async send(config: { webhookUrl: string; username?: string }, message: NotificationMessage) {
    if (!config.webhookUrl) {
      throw new Error('Discord webhook URL is required')
    }

    const color = message.status === 'up' ? 0x2ecc71 : 0xe74c3c // Green or Red

    await $fetch(config.webhookUrl, {
      method: 'POST',
      body: {
        username: config.username || 'Uptime Kuma',
        embeds: [{
          title: message.title,
          description: message.body,
          color,
          fields: [
            {
              name: 'Monitor',
              value: message.monitorName,
              inline: true
            },
            {
              name: 'Response Time',
              value: `${message.ping}ms`,
              inline: true
            },
            ...(message.monitorUrl ? [{
              name: 'URL',
              value: message.monitorUrl,
              inline: false
            }] : [])
          ],
          timestamp: message.time,
          footer: {
            text: 'Uptime Kuma'
          }
        }]
      }
    })
  }
}

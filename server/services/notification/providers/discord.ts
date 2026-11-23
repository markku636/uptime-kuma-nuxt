// server/services/notification/providers/discord.ts
import type { NotificationMessage } from '../sender'
import { notificationFetch } from '../transport'

export const discordProvider = {
  async send(config: { webhookUrl: string; username?: string }, message: NotificationMessage, options:{signal?:AbortSignal}={}) {
    if (!config.webhookUrl) {
      throw new Error('Discord webhook URL is required')
    }

    const color = message.status === 'up' ? 0x2ecc71 : 0xe74c3c // Green or Red

    await notificationFetch(config.webhookUrl, {
      method: 'POST',
      signal:options.signal,
      body: {
        username: config.username || 'SealWatch',
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
            text: 'SealWatch'
          }
        }]
      }
    })
  }
}

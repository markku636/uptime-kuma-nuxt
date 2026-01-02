// server/services/notification/providers/line.ts
import type { NotificationMessage } from '../sender'

export const lineProvider = {
  async send(config: { channelAccessToken: string; userId: string }, message: NotificationMessage) {
    if (!config.channelAccessToken || !config.userId) {
      throw new Error('LINE channel access token and user ID are required')
    }

    const emoji = message.status === 'up' ? '✅' : '🔴'
    const text = `${emoji} ${message.title}

Monitor: ${message.monitorName}
Status: ${message.status.toUpperCase()}
Message: ${message.body}
Response Time: ${message.ping}ms
${message.monitorUrl ? `URL: ${message.monitorUrl}` : ''}`

    await $fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: {
        to: config.userId,
        messages: [{
          type: 'text',
          text
        }]
      }
    })
  }
}

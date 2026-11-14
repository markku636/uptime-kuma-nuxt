// server/services/notification/providers/line.ts
import type { NotificationMessage } from '../sender'
import { notificationFetch } from '../transport'

export const lineProvider = {
  async send(config: { channelAccessToken: string; userId: string }, message: NotificationMessage, options:{signal?:AbortSignal}={}) {
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

    await notificationFetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      signal:options.signal,
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

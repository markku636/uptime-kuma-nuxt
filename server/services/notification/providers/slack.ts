// server/services/notification/providers/slack.ts
import type { NotificationMessage } from '../sender'
import { notificationFetch } from '../transport'

export const slackProvider = {
  async send(config: { webhookUrl: string; channel?: string }, message: NotificationMessage, options:{signal?:AbortSignal}={}) {
    if (!config.webhookUrl) {
      throw new Error('Slack webhook URL is required')
    }

    const color = message.status === 'up' ? 'good' : 'danger'

    await notificationFetch(config.webhookUrl, {
      method: 'POST',
      signal:options.signal,
      body: {
        channel: config.channel,
        username: 'SealWatch',
        attachments: [{
          color,
          title: message.title,
          text: message.body,
          fields: [
            {
              title: 'Monitor',
              value: message.monitorName,
              short: true
            },
            {
              title: 'Response Time',
              value: `${message.ping}ms`,
              short: true
            }
          ],
          footer: 'SealWatch',
          ts: Math.floor(new Date(message.time).getTime() / 1000)
        }]
      }
    })
  }
}

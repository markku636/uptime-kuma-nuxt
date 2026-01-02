// server/services/notification/providers/slack.ts
import type { NotificationMessage } from '../sender'

export const slackProvider = {
  async send(config: { webhookUrl: string; channel?: string }, message: NotificationMessage) {
    if (!config.webhookUrl) {
      throw new Error('Slack webhook URL is required')
    }

    const color = message.status === 'up' ? 'good' : 'danger'

    await $fetch(config.webhookUrl, {
      method: 'POST',
      body: {
        channel: config.channel,
        username: 'Uptime Kuma',
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
          footer: 'Uptime Kuma',
          ts: Math.floor(new Date(message.time).getTime() / 1000)
        }]
      }
    })
  }
}

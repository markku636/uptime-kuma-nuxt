// server/services/notification/providers/feishu.ts
import type { NotificationMessage } from '../sender'

export const feishuProvider = {
  async send(config: { webhookUrl: string }, message: NotificationMessage) {
    if (!config.webhookUrl) {
      throw new Error('Feishu webhook URL is required')
    }

    const color = message.status === 'up' ? 'green' : 'red'
    const emoji = message.status === 'up' ? '✅' : '❌'

    // Interactive card format
    const card = {
      msg_type: 'interactive',
      card: {
        config: {
          wide_screen_mode: true
        },
        header: {
          title: {
            tag: 'plain_text',
            content: `${emoji} ${message.title}`
          },
          template: color
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: message.body
            }
          },
          {
            tag: 'div',
            fields: [
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: `**Monitor:** ${message.monitorName}`
                }
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: `**Ping:** ${message.ping}ms`
                }
              }
            ]
          },
          ...(message.monitorUrl ? [{
            tag: 'action',
            actions: [{
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: 'View Monitor'
              },
              type: 'primary',
              url: message.monitorUrl
            }]
          }] : [])
        ]
      }
    }

    await $fetch(config.webhookUrl, {
      method: 'POST',
      body: card
    })
  }
}

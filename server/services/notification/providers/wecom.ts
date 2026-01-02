// server/services/notification/providers/wecom.ts
import type { NotificationMessage } from '../sender'

export const wecomProvider = {
  async send(config: { webhookUrl: string }, message: NotificationMessage) {
    if (!config.webhookUrl) {
      throw new Error('WeCom/企业微信 webhook URL is required')
    }

    const emoji = message.status === 'up' ? '✅' : '❌'

    // Markdown format
    const body = {
      msgtype: 'markdown',
      markdown: {
        content: `### ${emoji} ${message.title}\n` +
          `> **Monitor:** ${message.monitorName}\n` +
          `> **Status:** <font color="${message.status === 'up' ? 'info' : 'warning'}">${message.status === 'up' ? 'UP' : 'DOWN'}</font>\n` +
          `> **Response Time:** ${message.ping}ms\n\n` +
          `${message.body}` +
          (message.monitorUrl ? `\n\n[View Monitor](${message.monitorUrl})` : '')
      }
    }

    await $fetch(config.webhookUrl, {
      method: 'POST',
      body
    })
  }
}

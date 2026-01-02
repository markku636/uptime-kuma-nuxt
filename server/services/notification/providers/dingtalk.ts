// server/services/notification/providers/dingtalk.ts
import type { NotificationMessage } from '../sender'
import crypto from 'crypto'

export const dingtalkProvider = {
  async send(config: { webhookUrl: string; secret?: string }, message: NotificationMessage) {
    if (!config.webhookUrl) {
      throw new Error('DingTalk webhook URL is required')
    }

    let url = config.webhookUrl
    
    // Add signature if secret is provided
    if (config.secret) {
      const timestamp = Date.now()
      const stringToSign = `${timestamp}\n${config.secret}`
      const sign = crypto
        .createHmac('sha256', config.secret)
        .update(stringToSign)
        .digest('base64')
      
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
    }

    const emoji = message.status === 'up' ? '✅' : '❌'

    // Markdown format
    const body = {
      msgtype: 'markdown',
      markdown: {
        title: message.title,
        text: `### ${emoji} ${message.title}\n\n` +
          `**Monitor:** ${message.monitorName}\n\n` +
          `**Status:** ${message.status === 'up' ? 'UP' : 'DOWN'}\n\n` +
          `**Response Time:** ${message.ping}ms\n\n` +
          `${message.body}\n\n` +
          (message.monitorUrl ? `[View Monitor](${message.monitorUrl})` : '')
      }
    }

    await $fetch(url, {
      method: 'POST',
      body
    })
  }
}

// server/services/notification/providers/telegram.ts
import type { NotificationMessage } from '../sender'

export const telegramProvider = {
  async send(config: { botToken: string; chatId: string }, message: NotificationMessage) {
    if (!config.botToken || !config.chatId) {
      throw new Error('Telegram bot token and chat ID are required')
    }

    const emoji = message.status === 'up' ? '✅' : '🔴'
    const text = `${emoji} <b>${escapeHtml(message.title)}</b>

<b>Monitor:</b> ${escapeHtml(message.monitorName)}
<b>Status:</b> ${message.status.toUpperCase()}
<b>Message:</b> ${escapeHtml(message.body)}
<b>Response Time:</b> ${message.ping}ms
${message.monitorUrl ? `<b>URL:</b> ${escapeHtml(message.monitorUrl)}` : ''}`

    await $fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      body: {
        chat_id: config.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    })
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

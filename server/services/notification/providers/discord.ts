// server/services/notification/providers/discord.ts
import type { NotificationMessage } from '../sender'
import { notificationFetch } from '../transport'

export interface DiscordConfig {
  webhookUrl: string
  username?: string
  /**
   * 自訂的 agent 指令，只在 DOWN 事件附加到 embed 描述。
   * 由操作者自行填寫（不要放網址或金鑰），上限 1000 字避免超過 Discord embed 限制。
   */
  agentHint?: string
  /**
   * 可選的純文字前導內容（embed 上方）。若 agent 只監聽訊息內容中的 @提及或關鍵字，
   * 可在此填寫；上限 1000 字。刻意不自動帶入 monitor.url，避免網址內的 token 外洩。
   */
  content?: string
}

/** 純函式：組 Discord webhook body，方便單元測試不需真的打出去。 */
export function buildDiscordBody(message: NotificationMessage, config: DiscordConfig) {
  const color = message.status === 'up' ? 0x2ecc71 : 0xe74c3c // Green or Red
  const hint = typeof config.agentHint === 'string' ? config.agentHint.trim().slice(0, 1000) : ''
  const description = hint && message.status === 'down'
    ? `${message.body}\n\n🤖 ${hint}`
    : message.body

  const content = typeof config.content === 'string' ? config.content.trim().slice(0, 1000) : ''

  return {
    username: config.username || 'SealWatch',
    ...(content ? { content } : {}),
    embeds: [{
      title: message.title,
      description,
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
}

export const discordProvider = {
  async send(config: DiscordConfig, message: NotificationMessage, options: { signal?: AbortSignal } = {}) {
    if (!config.webhookUrl) {
      throw new Error('Discord webhook URL is required')
    }

    await notificationFetch(config.webhookUrl, {
      method: 'POST',
      signal: options.signal,
      body: buildDiscordBody(message, config)
    })
  }
}

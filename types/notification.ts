// types/notification.ts

export enum NotificationType {
  DISCORD = 'discord',
  SLACK = 'slack',
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  LINE = 'line',
}

export interface Notification {
  id: number
  name: string
  userId: number
  type: NotificationType
  config: Record<string, any>
  isDefault: boolean
  active: boolean
}

export interface CreateNotificationInput {
  name: string
  type: NotificationType
  config: Record<string, any>
  isDefault?: boolean
  active?: boolean
}

export interface UpdateNotificationInput extends Partial<CreateNotificationInput> {}

// Provider-specific configs
export interface DiscordConfig {
  webhookUrl: string
  username?: string
  avatarUrl?: string
}

export interface SlackConfig {
  webhookUrl: string
  channel?: string
  username?: string
}

export interface TelegramConfig {
  botToken: string
  chatId: string
}

export interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUsername?: string
  smtpPassword?: string
  fromEmail: string
  toEmail: string
}

export interface WebhookConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  body?: string
}

export interface LineConfig {
  channelAccessToken: string
  userId: string
}

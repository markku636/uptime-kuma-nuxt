// server/services/notification/providers/webhook.ts
import type { NotificationMessage } from '../sender'

export const webhookProvider = {
  async send(config: {
    url: string
    method?: 'GET' | 'POST' | 'PUT'
    headers?: Record<string, string>
    body?: string
  }, message: NotificationMessage) {
    if (!config.url) {
      throw new Error('Webhook URL is required')
    }

    const method = config.method || 'POST'
    const headers = config.headers || {}

    // Prepare body - replace placeholders if custom body template is provided
    let body: any
    if (config.body) {
      body = config.body
        .replace(/\{\{title\}\}/g, message.title)
        .replace(/\{\{body\}\}/g, message.body)
        .replace(/\{\{monitorName\}\}/g, message.monitorName)
        .replace(/\{\{monitorUrl\}\}/g, message.monitorUrl || '')
        .replace(/\{\{status\}\}/g, message.status)
        .replace(/\{\{ping\}\}/g, String(message.ping))
        .replace(/\{\{time\}\}/g, message.time)
    } else {
      body = {
        title: message.title,
        body: message.body,
        monitor: {
          name: message.monitorName,
          url: message.monitorUrl
        },
        status: message.status,
        ping: message.ping,
        time: message.time
      }
    }

    await $fetch(config.url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: method !== 'GET' ? body : undefined
    })
  }
}

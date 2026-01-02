// server/services/notification/providers/ntfy.ts
import type { NotificationMessage } from '../sender'

export const ntfyProvider = {
  async send(config: { serverUrl?: string; topic: string; priority?: number; username?: string; password?: string }, message: NotificationMessage) {
    if (!config.topic) {
      throw new Error('Ntfy topic is required')
    }

    const serverUrl = config.serverUrl || 'https://ntfy.sh'
    const url = `${serverUrl.replace(/\/$/, '')}/${config.topic}`

    const headers: Record<string, string> = {
      'Title': message.title,
      'Priority': String(config.priority || (message.status === 'up' ? 3 : 5)),
      'Tags': message.status === 'up' ? 'white_check_mark' : 'x'
    }

    if (message.monitorUrl) {
      headers['Click'] = message.monitorUrl
      headers['Actions'] = `view, View Monitor, ${message.monitorUrl}`
    }

    // Basic auth if provided
    if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    await $fetch(url, {
      method: 'POST',
      headers,
      body: message.body
    })
  }
}

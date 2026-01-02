// server/services/notification/providers/gotify.ts
import type { NotificationMessage } from '../sender'

export const gotifyProvider = {
  async send(config: { serverUrl: string; appToken: string; priority?: number }, message: NotificationMessage) {
    if (!config.serverUrl || !config.appToken) {
      throw new Error('Gotify server URL and app token are required')
    }

    const url = `${config.serverUrl.replace(/\/$/, '')}/message?token=${config.appToken}`

    await $fetch(url, {
      method: 'POST',
      body: {
        title: message.title,
        message: message.body,
        priority: config.priority || (message.status === 'up' ? 5 : 8),
        extras: {
          'client::display': {
            contentType: 'text/markdown'
          }
        }
      }
    })
  }
}

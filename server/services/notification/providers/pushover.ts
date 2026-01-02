// server/services/notification/providers/pushover.ts
import type { NotificationMessage } from '../sender'

export const pushoverProvider = {
  async send(config: { userKey: string; appToken: string; device?: string; sound?: string; priority?: number }, message: NotificationMessage) {
    if (!config.userKey || !config.appToken) {
      throw new Error('Pushover user key and app token are required')
    }

    const priority = config.priority ?? (message.status === 'up' ? 0 : 1)

    const body: any = {
      token: config.appToken,
      user: config.userKey,
      title: message.title,
      message: message.body,
      priority,
      html: 1
    }

    if (config.device) {
      body.device = config.device
    }

    if (config.sound) {
      body.sound = config.sound
    }

    if (message.monitorUrl) {
      body.url = message.monitorUrl
      body.url_title = 'View Monitor'
    }

    // For priority 2 (emergency), retry and expire are required
    if (priority === 2) {
      body.retry = 60
      body.expire = 3600
    }

    await $fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      body
    })
  }
}

// server/services/notification/providers/apprise.ts
import type { NotificationMessage } from '../sender'

export const appriseProvider = {
  async send(config: { appriseUrl: string; urls: string[]; tag?: string }, message: NotificationMessage) {
    if (!config.appriseUrl) {
      throw new Error('Apprise API URL is required')
    }

    const body: any = {
      body: message.body,
      title: message.title,
      type: message.status === 'up' ? 'success' : 'failure'
    }

    // Use URLs array or tag
    if (config.urls && config.urls.length > 0) {
      body.urls = config.urls.join(',')
    } else if (config.tag) {
      body.tag = config.tag
    }

    await $fetch(`${config.appriseUrl.replace(/\/$/, '')}/notify`, {
      method: 'POST',
      body
    })
  }
}

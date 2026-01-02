// server/services/notification/providers/opsgenie.ts
import type { NotificationMessage } from '../sender'

export const opsgenieProvider = {
  async send(config: { apiKey: string; region?: string; priority?: string }, message: NotificationMessage) {
    if (!config.apiKey) {
      throw new Error('Opsgenie API key is required')
    }

    const region = config.region || 'us'
    const baseUrl = region === 'eu' 
      ? 'https://api.eu.opsgenie.com' 
      : 'https://api.opsgenie.com'

    if (message.status === 'up') {
      // Close alert
      const alias = `uptime-kuma-${message.monitorName}`.replace(/[^a-zA-Z0-9_-]/g, '-')
      
      await $fetch(`${baseUrl}/v2/alerts/${alias}/close?identifierType=alias`, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${config.apiKey}`
        },
        body: {
          note: message.body
        }
      })
    } else {
      // Create alert
      const body = {
        message: message.title,
        alias: `uptime-kuma-${message.monitorName}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
        description: message.body,
        priority: config.priority || 'P3',
        source: 'Uptime Kuma',
        tags: ['uptime-kuma', message.monitorName],
        details: {
          monitor: message.monitorName,
          url: message.monitorUrl || '',
          response_time: `${message.ping}ms`
        }
      }

      await $fetch(`${baseUrl}/v2/alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${config.apiKey}`
        },
        body
      })
    }
  }
}

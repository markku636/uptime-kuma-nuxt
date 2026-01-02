// server/services/notification/providers/pagerduty.ts
import type { NotificationMessage } from '../sender'

export const pagerdutyProvider = {
  async send(config: { integrationKey: string; severity?: string }, message: NotificationMessage) {
    if (!config.integrationKey) {
      throw new Error('PagerDuty integration key is required')
    }

    const body = {
      routing_key: config.integrationKey,
      event_action: message.status === 'up' ? 'resolve' : 'trigger',
      dedup_key: `uptime-kuma-${message.monitorName}`,
      payload: {
        summary: message.title,
        source: message.monitorName,
        severity: config.severity || (message.status === 'up' ? 'info' : 'critical'),
        timestamp: message.time,
        custom_details: {
          monitor: message.monitorName,
          url: message.monitorUrl,
          response_time: `${message.ping}ms`,
          message: message.body
        }
      },
      ...(message.monitorUrl && {
        links: [{
          href: message.monitorUrl,
          text: 'View Monitor'
        }]
      })
    }

    await $fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      body
    })
  }
}

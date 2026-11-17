// server/services/notification/template.ts
// Fill a notification template. Two placeholder styles exist in the forms:
// uptime-kuma's ({{ msg }}, {{ monitorJSON.name }}, {{ heartbeatJSON.time }})
// and the webhook's ({{title}}, {{monitorName}}, {{status}} …). Unknown
// placeholders are left as written. Pure, see tests/server/notification-template.test.ts.
import type { NotificationMessage } from './sender'

export function templateValues(message: NotificationMessage): Record<string, string> {
  const statusText = message.status === 'up' ? 'UP' : 'DOWN'
  return {
    // webhook style
    title: message.title,
    body: message.body,
    monitorName: message.monitorName,
    monitorUrl: message.monitorUrl ?? '',
    status: message.status,
    ping: String(message.ping),
    time: message.time,
    // uptime-kuma style
    msg: message.body,
    'monitorJSON.name': message.monitorName,
    'monitorJSON.url': message.monitorUrl ?? '',
    'monitorJSON.hostname': message.monitorUrl ?? '',
    'heartbeatJSON.status': message.status === 'up' ? '1' : '0',
    'heartbeatJSON.msg': message.body,
    'heartbeatJSON.time': message.time,
    'heartbeatJSON.ping': String(message.ping),
    statusText,
  }
}

export function renderTemplate(template: string, message: NotificationMessage, escape?: (v: string) => string): string {
  const values = templateValues(message)
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? (escape ? escape(values[name]) : values[name]) : match)
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

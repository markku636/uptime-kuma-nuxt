// server/services/notification/sender.ts
import { hydrateResource } from '../../utils/resource-secrets'
import { prisma } from '../../utils/prisma'
import type { CheckResult } from '../monitor/checker'

// Import providers
import { discordProvider } from './providers/discord'
import { slackProvider } from './providers/slack'
import { telegramProvider } from './providers/telegram'
import { emailProvider } from './providers/email'
import { webhookProvider } from './providers/webhook'
import { lineProvider } from './providers/line'

const providers: Record<string, any> = {
  discord: discordProvider,
  slack: slackProvider,
  telegram: telegramProvider,
  email: emailProvider,
  webhook: webhookProvider,
  line: lineProvider,
}

export interface NotificationMessage {
  title: string
  body: string
  monitorName: string
  monitorId?: number
  monitorUrl?: string
  status: 'up' | 'down'
  ping: number
  time: string
}

/**
 * Format notification message
 */
export function formatMessage(monitor: any, result: CheckResult): NotificationMessage {
  const status = result.status === 1 ? 'up' : 'down'
  const statusEmoji = result.status === 1 ? '🟢' : '🔴'
  const statusText = result.status === 1 ? 'UP' : 'DOWN'

  const reason = result.code && /^(AUDIT_|FLOW_)/.test(result.code) && result.msg && result.msg !== 'State changed'
    ? `${statusText} · ${result.code} · ${result.msg}`.slice(0, 400)
    : null
  return {
    title: `${statusEmoji} ${monitor.name} is ${statusText}`,
    body: reason ?? (Number.isInteger(monitor.certificateDays)?`Certificate expires in ${monitor.certificateDays} days`:`${statusText}${result.code&&/^[A-Z0-9_]{1,64}$/.test(result.code)?' · '+result.code:''}`),
    monitorName: monitor.name,
    monitorId: typeof monitor.id === 'number' ? monitor.id : undefined,
    monitorUrl: undefined,
    status,
    ping: result.ping,
    time: typeof monitor.eventTime==='string'&&!Number.isNaN(Date.parse(monitor.eventTime))?new Date(monitor.eventTime).toISOString():new Date().toISOString(),
  }
}

/**
 * Send notification using specified provider
 */
export async function sendNotification(
  notification: { type: string; config: any },
  monitor: any,
  result: CheckResult,
  signal?:AbortSignal
): Promise<void> {
  const provider = providers[notification.type]
  
  if (!provider) {
    throw new Error('UNSUPPORTED_PROVIDER')
  }

  const message = formatMessage(monitor, result)
  if ((result as any).eventType === 'response-time') {
    const limit = (result as any).threshold
    message.title = `⚠️ ${monitor.name} is responding slowly`
    message.body = `Response time ${result.ping} ms exceeded the ${limit} ms threshold`
  }
  if ((result as any).eventType === 'resend') {
    message.title = `🔁 ${monitor.name} is still down`
    message.body = `Still down after ${(result as any).downMinutes ?? '?'} minutes`
  }

  try {
    await provider.send(notification.config, message,{signal})
    console.log('[Notification] Delivery completed')
  } catch (error: any) {
    console.error('[Notification] Provider delivery failed')
    throw error  // Re-throw to propagate the error
  }
}

/**
 * Send notifications for a monitor based on status change
 */
export async function sendNotificationForMonitor(
  monitor: any,
  result: CheckResult,
  previousStatus: number
): Promise<void> {
  if(!Number.isSafeInteger(monitor.workspaceId))throw new Error('Missing workspace context for notification')
  // Only send notifications on status change
  if (result.status === previousStatus) {
    return
  }

  // Get all notifications linked to this monitor
  const monitorNotifications = await prisma.monitorNotification.findMany({
    where: { monitorId: monitor.id, monitor:{workspaceId:monitor.workspaceId}, notification:{workspaceId:monitor.workspaceId} },
    include: { notification: true }
  })

  // Also get default notifications
  const defaultNotifications = await prisma.notification.findMany({
    where: {
      workspaceId: monitor.workspaceId,
      isDefault: true,
      active: true,
    }
  })

  // Combine and deduplicate
  const allNotifications = [
    ...monitorNotifications.map(mn => mn.notification),
    ...defaultNotifications
  ].filter((n, i, arr) => 
    n.active && arr.findIndex(x => x.id === n.id) === i
  )

  console.log(`[Notification] Sending ${allNotifications.length} notifications for monitor ${monitor.id}`)

  // Send all notifications in parallel
  await Promise.allSettled(
    allNotifications.map(notification =>
      sendNotification(
        { type: notification.type, config: hydrateResource('notification',notification).config },
        monitor,
        result
      )
    )
  )
}

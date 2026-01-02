// server/services/notification/sender.ts
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
  monitorUrl?: string
  status: 'up' | 'down'
  ping: number
  time: string
}

/**
 * Format notification message
 */
function formatMessage(monitor: any, result: CheckResult): NotificationMessage {
  const status = result.status === 1 ? 'up' : 'down'
  const statusEmoji = result.status === 1 ? '🟢' : '🔴'
  const statusText = result.status === 1 ? 'UP' : 'DOWN'

  return {
    title: `${statusEmoji} ${monitor.name} is ${statusText}`,
    body: result.msg,
    monitorName: monitor.name,
    monitorUrl: monitor.url,
    status,
    ping: result.ping,
    time: new Date().toISOString(),
  }
}

/**
 * Send notification using specified provider
 */
export async function sendNotification(
  notification: { type: string; config: any },
  monitor: any,
  result: CheckResult
): Promise<void> {
  const provider = providers[notification.type]
  
  if (!provider) {
    console.error(`[Notification] Unknown provider type: ${notification.type}`)
    return
  }

  const message = formatMessage(monitor, result)

  try {
    await provider.send(notification.config, message)
    console.log(`[Notification] Sent ${notification.type} notification for ${monitor.name}`)
  } catch (error: any) {
    console.error(`[Notification] Failed to send ${notification.type} notification:`, error.message)
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
  // Only send notifications on status change
  if (result.status === previousStatus) {
    return
  }

  // Get all notifications linked to this monitor
  const monitorNotifications = await prisma.monitorNotification.findMany({
    where: { monitorId: monitor.id },
    include: { notification: true }
  })

  // Also get default notifications
  const defaultNotifications = await prisma.notification.findMany({
    where: {
      userId: monitor.userId,
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
        { type: notification.type, config: notification.config as any },
        monitor,
        result
      )
    )
  )
}

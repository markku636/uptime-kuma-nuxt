// server/services/notification/sender.ts
import { prisma } from '../../utils/prisma'
import type { CheckResult } from '../monitor/checker'

import * as providerModules from './providers/index'
import { providers as providerExports } from './providers/index'
import { normalizeType, notificationConfig } from './config-aliases'

type Send = (config: any, message: NotificationMessage, monitor: any) => Promise<void>

/**
 * The provider for a notification type, from the full registry
 * (providers/index.ts). Type names match with or without dashes / dots
 * ("google-chat" = "googlechat"). Two provider styles exist:
 * { send(config, message) } objects and modules exporting
 * send(config, title, text, status, monitor?, heartbeat?).
 */
export function resolveProvider(type: string): Send | null {
  const key = Object.keys(providerExports).find(k => normalizeType(k) === normalizeType(type))
  const mod: any = key ? (providerModules as any)[(providerExports as any)[key]] : null
  if (!mod || typeof mod.send !== 'function') return null
  // send(config, message) objects vs send(config, title, text, status, ...)
  // (modules and some objects): told apart by the declared parameters
  if (mod.send.length >= 3) {
    return (config, message, monitor) => mod.send(
      config,
      message.title,
      `[${message.monitorName}] ${message.status === 'up' ? 'UP' : 'DOWN'}: ${message.body}`,
      message.status,
      monitor ? { id: monitor.id, name: monitor.name, url: monitor.url, type: monitor.type } : undefined,
      { status: message.status === 'up' ? 1 : 0, msg: message.body, ping: message.ping, time: message.time },
    )
  }
  return (config, message) => mod.send(config, message)
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
  const provider = resolveProvider(notification.type)
  
  if (!provider) {
    throw new Error(`Unknown notification provider type: ${notification.type}`)
  }

  const message = formatMessage(monitor, result)
  // The forms' field names → the provider's
  const config = notificationConfig(notification.type, notification.config)

  try {
    await provider(config, message, monitor)
    console.log(`[Notification] Sent ${notification.type} notification for ${monitor.name}`)
  } catch (error: any) {
    console.error(`[Notification] Failed to send ${notification.type} notification:`, error.message)
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

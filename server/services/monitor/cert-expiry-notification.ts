// server/services/monitor/cert-expiry-notification.ts
// Certificate expiry notification service

import { prisma } from '../../utils/prisma'
import { sendNotification } from '../notification/sender'

// Default notification days before expiry
const DEFAULT_NOTIFY_DAYS = [7, 14, 21]

interface TLSInfo {
  valid: boolean
  certInfo?: {
    daysRemaining: number
    subject?: {
      CN?: string
    }
    validTo?: string
    fingerprint256?: string
    issuerCertificate?: TLSInfo['certInfo']
  }
}

/**
 * Check certificate expiry and send notifications if needed
 */
export async function checkCertExpiryNotifications(
  monitor: any,
  tlsInfo: any
): Promise<void> {
  // Skip if monitor doesn't have expiry notification enabled
  if (!monitor.expiryNotification || !tlsInfo) {
    return
  }

  // getTLSInfo (checkers/tls-checker) returns a flat object; a { certInfo }
  // chain is also accepted
  const leaf: TLSInfo['certInfo'] | null = tlsInfo.certInfo
    ?? (typeof tlsInfo.daysRemaining === 'number'
      ? { daysRemaining: tlsInfo.daysRemaining, subject: { CN: typeof tlsInfo.subject === 'string' ? tlsInfo.subject : tlsInfo.subject?.CN } }
      : null)
  if (!leaf) return

  const daysRemaining = leaf.daysRemaining
  if (daysRemaining == null || daysRemaining < 0) {
    return
  }

  // The monitor's own days, else Settings (tlsExpiryDays), else the default
  let notifyDays = DEFAULT_NOTIFY_DAYS
  const own = Array.isArray(monitor.tlsExpiryDays) ? monitor.tlsExpiryDays.filter((d: unknown) => Number(d) > 0).map(Number) : []
  if (own.length) {
    notifyDays = own
  } else {
    try {
      const setting = await prisma.setting.findFirst({
        where: { key: { in: ['tlsExpiryDays', 'tlsExpiryNotifyDays'] } },
        orderBy: { key: 'asc' },
      })
      const parsed = setting?.value ? JSON.parse(setting.value) : null
      if (Array.isArray(parsed) && parsed.length) notifyDays = parsed.map(Number).filter(d => d > 0)
    } catch {
      // Use default if setting not found or invalid
    }
  }

  // Renewed (or far from expiry): start the warnings again for the next cycle
  if (daysRemaining > Math.max(...notifyDays)) {
    await clearCertExpiryNotificationHistory(monitor.id)
    return
  }

  // Get notifications for this monitor
  const monitorNotifications = await prisma.monitorNotification.findMany({
    where: { monitorId: monitor.id },
    include: { notification: true }
  })

  const defaultNotifications = await prisma.notification.findMany({
    where: {
      userId: monitor.userId,
      isDefault: true,
      active: true
    }
  })

  const allNotifications = [
    ...monitorNotifications.map(mn => mn.notification),
    ...defaultNotifications
  ].filter((n, i, arr) => 
    n.active && arr.findIndex(x => x.id === n.id) === i
  )

  if (allNotifications.length === 0) {
    console.log(`[CertExpiry] No notifications configured for monitor ${monitor.id}`)
    return
  }

  // Check each certificate in the chain
  let certInfo = leaf
  while (certInfo) {
    const certDaysRemaining = certInfo.daysRemaining
    const subjectCN = certInfo.subject?.CN || 'Unknown'

    for (const targetDays of notifyDays) {
      if (certDaysRemaining <= targetDays) {
        // Check if we've already sent a notification for this target
        const alreadySent = await hasNotificationBeenSent(
          monitor.id,
          'certificate',
          targetDays
        )

        if (!alreadySent) {
          console.log(`[CertExpiry] Certificate "${subjectCN}" expires in ${certDaysRemaining} days (threshold: ${targetDays} days)`)
          
          // Send notification to all configured providers
          await sendCertExpiryNotification(
            monitor,
            subjectCN,
            certDaysRemaining,
            targetDays,
            allNotifications
          )
          
          // Record that we've sent this notification
          await recordNotificationSent(monitor.id, 'certificate', targetDays)
        }
      }
    }

    // Move to issuer certificate
    const issuerCert = certInfo.issuerCertificate
    if (!issuerCert) break
    certInfo = issuerCert
  }
}

/**
 * Check if a notification has already been sent
 */
async function hasNotificationBeenSent(
  monitorId: number,
  type: string,
  days: number
): Promise<boolean> {
  try {
    // Check notification_sent_history table (if exists)
    const result = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM notification_sent_history 
      WHERE type = ${type} 
      AND monitor_id = ${monitorId} 
      AND days <= ${days}
      LIMIT 1
    `
    return result.length > 0
  } catch {
    // Table may not exist yet, return false
    return false
  }
}

/**
 * Record that a notification has been sent
 */
async function recordNotificationSent(
  monitorId: number,
  type: string,
  days: number
): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO notification_sent_history (type, monitor_id, days, created_at)
      VALUES (${type}, ${monitorId}, ${days}, NOW())
      ON CONFLICT (type, monitor_id, days) DO NOTHING
    `
  } catch (error) {
    console.error('[CertExpiry] Failed to record notification sent:', error)
  }
}

/**
 * Send certificate expiry notification
 */
async function sendCertExpiryNotification(
  monitor: any,
  subjectCN: string,
  daysRemaining: number,
  targetDays: number,
  notifications: any[]
): Promise<void> {
  const mockResult = {
    status: 0, // Treat as "down" (warning)
    ping: 0,
    msg: `⚠️ Certificate "${subjectCN}" will expire in ${daysRemaining} days`
  }

  const mockMonitor = {
    ...monitor,
    name: `${monitor.name} - Certificate Expiry Warning`
  }

  for (const notification of notifications) {
    try {
      let config = notification.config
      if (typeof config === 'string') {
        config = JSON.parse(config)
      }

      await sendNotification(
        { type: notification.type, config },
        mockMonitor,
        mockResult
      )
      
      console.log(`[CertExpiry] Sent ${notification.type} notification for certificate "${subjectCN}"`)
    } catch (error: any) {
      console.error(`[CertExpiry] Failed to send ${notification.type} notification:`, error.message)
    }
  }
}

/**
 * Clear certificate expiry notification history for a monitor
 * (Call this when certificate is renewed)
 */
export async function clearCertExpiryNotificationHistory(monitorId: number): Promise<void> {
  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM notification_sent_history 
      WHERE type = 'certificate' AND monitor_id = ${monitorId}
    `
    if (deleted) console.log(`[CertExpiry] Cleared notification history for monitor ${monitorId}`)
  } catch (error) {
    console.error('[CertExpiry] Failed to clear notification history:', error)
  }
}

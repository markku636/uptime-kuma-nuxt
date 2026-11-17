// Certificate expiry warnings: once per threshold, reset after renewal
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent: { type: string; monitorId: number; days: number }[] = []
const notifications: any[] = []

vi.mock('../../server/utils/prisma', () => ({
  prisma: {
    setting: { findFirst: async () => null },
    monitorNotification: { findMany: async () => [{ notification: { id: 1, type: 'webhook', active: true, config: {} } }] },
    notification: { findMany: async () => [] },
    // hasNotificationBeenSent: type, monitorId, days
    $queryRaw: async (_s: TemplateStringsArray, type: string, monitorId: number, days: number) =>
      sent.filter(r => r.type === type && r.monitorId === monitorId && r.days <= days).map(() => ({ '?column?': 1 })),
    // recordNotificationSent (type, monitorId, days) / clear (monitorId)
    $executeRaw: async (s: TemplateStringsArray, ...v: any[]) => {
      if (s.join('').includes('DELETE')) {
        const before = sent.length
        for (let i = sent.length - 1; i >= 0; i--) if (sent[i].monitorId === v[0]) sent.splice(i, 1)
        return before - sent.length
      }
      sent.push({ type: v[0], monitorId: v[1], days: v[2] })
      return 1
    },
  },
}))
vi.mock('../../server/services/notification/sender', () => ({
  sendNotification: async (n: any, monitor: any, result: any) => { notifications.push({ n, monitor, result }) },
}))

const { checkCertExpiryNotifications } = await import('../../server/services/monitor/cert-expiry-notification')
const monitor = { id: 5, name: 'Site', userId: 1, expiryNotification: true, tlsExpiryDays: [7, 14, 21] }
// What getTLSInfo returns: a flat object
const tls = (daysRemaining: number) => ({ valid: true, subject: 'example.test', daysRemaining })

beforeEach(() => { sent.length = 0; notifications.length = 0 })

describe('checkCertExpiryNotifications', () => {
  it('warns once for the threshold reached', async () => {
    await checkCertExpiryNotifications(monitor, tls(13))
    expect(notifications).toHaveLength(1)
    expect(notifications[0].result.msg).toMatch(/expire in 13 days/)
    expect(sent.map(s => s.days)).toEqual([14])
    await checkCertExpiryNotifications(monitor, tls(12))
    expect(notifications).toHaveLength(1)
  })

  it('warns again at the next threshold', async () => {
    await checkCertExpiryNotifications(monitor, tls(13))
    await checkCertExpiryNotifications(monitor, tls(6))
    expect(notifications).toHaveLength(2)
    expect(sent.map(s => s.days).sort()).toEqual([14, 7].sort())
  })

  it('starts over after the certificate is renewed', async () => {
    await checkCertExpiryNotifications(monitor, tls(13))
    await checkCertExpiryNotifications(monitor, tls(89))
    expect(sent).toHaveLength(0)
    await checkCertExpiryNotifications(monitor, tls(13))
    expect(notifications).toHaveLength(2)
  })

  it('does nothing when switched off', async () => {
    await checkCertExpiryNotifications({ ...monitor, expiryNotification: false }, tls(3))
    expect(notifications).toHaveLength(0)
  })
})

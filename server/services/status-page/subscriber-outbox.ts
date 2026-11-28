// 狀態頁訂閱者通知：durable outbox + 有界派送，失敗重試、SMTP 未設定直接死信。
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { sendSubscriberMail } from './subscriber-mail'
import { openSubscriberUrl, sendSubscriberWebhook } from './subscriber-webhook'

export type StatusPageEvent = 'incident-created' | 'incident-updated' | 'incident-resolved' | 'maintenance-started' | 'maintenance-ended'

export interface SubscriberPayload {
  pageSlug?: string
  pageTitle?: string
  title: string
  message: string
  incidentId?: number
  event: StatusPageEvent
}

const MAX_SUBSCRIBERS = 200
const MAX_ATTEMPTS = 5

export async function enqueueSubscriberNotifications(
  db: any,
  statusPageId: number,
  payload: SubscriberPayload,
): Promise<number> {
  const page = await db.statusPage.findUnique({ where: { id: statusPageId }, select: { slug: true, title: true } })
  if (!page || !page.slug) return 0
  const subscribers = await db.statusPageSubscriber.findMany({
    where: { statusPageId, verifiedAt: { not: null } },
    select: { id: true }, take: MAX_SUBSCRIBERS, orderBy: { id: 'asc' },
  })
  if (!subscribers.length) return 0
  const full: SubscriberPayload = { ...payload, pageSlug: page.slug, pageTitle: page.title }
  await db.statusPageNotificationOutbox.createMany({
    data: subscribers.map((row: { id: number }) => ({
      statusPageId, subscriberId: row.id, eventType: full.event,
      payload: full as unknown as Prisma.InputJsonValue, status: 'pending', nextAttemptAt: new Date(),
    })),
    skipDuplicates: true,
  })
  return subscribers.length
}

export function formatSubscriberMail(payload: SubscriberPayload): { subject: string; text: string } {
  const base = process.env.NUXT_PUBLIC_APP_URL || ''
  const link = `${base}/status/${encodeURIComponent(payload.pageSlug || '')}`
  const label: Record<StatusPageEvent, string> = {
    'incident-created': 'New incident',
    'incident-updated': 'Incident update',
    'incident-resolved': 'Incident resolved',
    'maintenance-started': 'Maintenance started',
    'maintenance-ended': 'Maintenance ended',
  }
  return {
    subject: `[${payload.pageTitle || 'Status'}] ${label[payload.event]}: ${payload.title}`.slice(0, 200),
    text: `${label[payload.event]}: ${payload.title}\n\n${payload.message}\n\nStatus page: ${link}`.slice(0, 20_000),
  }
}

export class SubscriberOutboxDispatcher {
  readonly metrics = { claimed: 0, delivered: 0, failed: 0, dead: 0 }
  private timer: NodeJS.Timeout | undefined
  private polling = false
  private draining = false
  constructor(
    readonly options: { pollMs: number; maxAttempts: number; backoffMs: number } = { pollMs: 5000, maxAttempts: MAX_ATTEMPTS, backoffMs: 30_000 },
    readonly db: any = prisma,
  ) {}
  start(): void {
    this.timer = setInterval(() => void this.poll(), this.options.pollMs)
    this.timer.unref()
    void this.poll()
  }
  stop(): void { this.draining = true; if (this.timer) clearInterval(this.timer) }

  async poll(): Promise<void> {
    if (this.draining || this.polling) return
    this.polling = true
    try {
      const rows = await this.db.$queryRaw(Prisma.sql`
        UPDATE status_page_notification_outbox SET status='processing'
        WHERE id IN (
          SELECT id FROM status_page_notification_outbox
          WHERE status='pending' AND next_attempt_at<=statement_timestamp()
          ORDER BY id LIMIT 10 FOR UPDATE SKIP LOCKED
        ) RETURNING id, subscriber_id, status_page_id, payload
      `) as Array<{ id: bigint; subscriber_id: number; status_page_id: number; payload: SubscriberPayload }>
      await Promise.all(rows.map(row => this.deliver(row)))
    } catch { /* 下一輪再試 */ } finally { this.polling = false }
  }

  private async deliver(row: { id: bigint; subscriber_id: number; status_page_id: number; payload: SubscriberPayload }): Promise<void> {
    this.metrics.claimed++
    try {
      const subscriber = await this.db.statusPageSubscriber.findUnique({ where: { id: row.subscriber_id }, select: { email: true, kind: true, url: true } })
      if (!subscriber) { await this.finish(row.id, 'cancelled'); return }
      if (subscriber.kind === 'webhook') {
        const page = await this.db.statusPage.findUnique({ where: { id: row.status_page_id }, select: { workspaceId: true } })
        const target = page ? openSubscriberUrl(subscriber.url, page.workspaceId, row.status_page_id) : null
        if (!target) { await this.finish(row.id, 'dead'); return }
        await sendSubscriberWebhook(target, { event: row.payload.event, title: row.payload.title, message: row.payload.message, pageSlug: row.payload.pageSlug, incidentId: row.payload.incidentId })
      } else {
        const mail = formatSubscriberMail(row.payload)
        await sendSubscriberMail(subscriber.email, mail.subject, mail.text)
      }
      await this.finish(row.id, 'delivered')
      this.metrics.delivered++
    } catch (error: any) {
      this.metrics.failed++
      const dead = error?.message === 'UNSUPPORTED_PROVIDER'
      await this.db.statusPageNotificationOutbox.update({ where: { id: row.id }, data: {
        status: dead ? 'dead' : 'pending', attempts: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + this.options.backoffMs),
      } }).catch(() => {})
      if (dead) this.metrics.dead++
    }
  }

  private async finish(id: bigint, status: string): Promise<void> {
    await this.db.statusPageNotificationOutbox.update({ where: { id }, data: { status, completedAt: new Date() } })
  }
}

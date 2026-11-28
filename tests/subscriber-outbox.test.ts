import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enqueueSubscriberNotifications, formatSubscriberMail } from '../server/services/status-page/subscriber-outbox'

function mockDb(subscribers: Array<{ id: number }>) {
  const created: any[] = []
  return {
    created,
    statusPage: { findUnique: async () => ({ slug: 'demo', title: 'Demo status' }) },
    statusPageSubscriber: { findMany: async ({ take }: any) => subscribers.slice(0, take) },
    statusPageNotificationOutbox: { createMany: async ({ data }: any) => { created.push(...data) } },
  }
}

test('enqueue only targets verified subscribers and carries a bounded payload', async () => {
  const db = mockDb([{ id: 1 }, { id: 2 }])
  const count = await enqueueSubscriberNotifications(db, 7, {
    event: 'incident-created', title: 'API down', message: 'Investigating', incidentId: 9,
  })
  assert.equal(count, 2)
  assert.equal(db.created.length, 2)
  assert.equal(db.created[0].statusPageId, 7)
  assert.equal(db.created[0].payload.pageSlug, 'demo')
  assert.equal(db.created[0].payload.event, 'incident-created')
})

test('mail subject and text include page, event and status link', () => {
  const previous = process.env.NUXT_PUBLIC_APP_URL
  process.env.NUXT_PUBLIC_APP_URL = 'https://uptime.markkulab.net'
  try {
    const mail = formatSubscriberMail({ event: 'incident-resolved', pageSlug: 'demo', pageTitle: 'Demo status', title: 'API down', message: 'Fixed' })
    assert.match(mail.subject, /Demo status.*Incident resolved.*API down/)
    assert.match(mail.text, /Fixed/)
    assert.match(mail.text, /https:\/\/uptime\.markkulab\.net\/status\/demo/)
  } finally {
    if (previous === undefined) delete process.env.NUXT_PUBLIC_APP_URL
    else process.env.NUXT_PUBLIC_APP_URL = previous
  }
})

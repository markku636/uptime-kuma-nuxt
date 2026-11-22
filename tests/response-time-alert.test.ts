import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { commitMonitorResult } from '../server/services/monitor/commit-result'

function makeTx(ping: number) {
  const outbox: any[] = []
  const dedupe: any[] = []
  const now = new Date('2026-11-22T00:00:00.000Z')
  const tx: any = {
    $queryRaw: async () => [{ now }],
    heartbeat: { create: async ({ data }: any) => ({ id: 1, ...data }) },
    monitorState: {
      findUnique: async () => ({ status: 1, ping, statusChangedAt: now, checkedAt: now, revision: 0n }),
      upsert: async () => ({}),
    },
    notification: { findMany: async () => [{ id: 7 }] },
    notificationDedupe: {
      createManyAndReturn: async ({ data }: any) => { dedupe.push(...data); return data.map((row: any) => ({ key: row.key })) },
    },
    notificationOutbox: { createMany: async ({ data }: any) => { outbox.push(...data) } },
  }
  return { tx, outbox, dedupe }
}

const monitor: any = {
  id: 42, workspaceId: 1, environmentId: 1, name: 'slow.example',
  runId: '00000000-0000-4000-8000-000000000001', scheduledFor: new Date(), configVersion: 1,
  interval: 60, responseTimeThreshold: 100, expiryNotification: false,
}
const check: any = { status: 1, ping: 250, code: 'CHECK_COMPLETE', assertionResults: undefined }

describe('response-time alerts', () => {
  it('enqueues one deduped alert when a healthy check crosses the threshold', async () => {
    const { tx, outbox, dedupe } = makeTx(50)
    await commitMonitorResult(tx, monitor, check)
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0].eventType, 'response-time')
    assert.equal(outbox[0].payload.code, 'SLOW_RESPONSE')
    assert.equal(outbox[0].payload.threshold, 100)
    assert.match(outbox[0].dedupeKey, /^[a-f0-9]{64}$/)
    assert.equal(dedupe[0].key, outbox[0].dedupeKey)
  })

  it('does not alert when the previous check was already slow', async () => {
    const { tx, outbox } = makeTx(200)
    await commitMonitorResult(tx, monitor, check)
    assert.equal(outbox.length, 0)
  })

  it('does not alert below the threshold', async () => {
    const { tx, outbox } = makeTx(20)
    await commitMonitorResult(tx, monitor, { ...check, ping: 80 })
    assert.equal(outbox.length, 0)
  })
})

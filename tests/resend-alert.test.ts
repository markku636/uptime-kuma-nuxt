import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { commitMonitorResult } from '../server/services/monitor/commit-result'

function makeTx(nowIso: string, downSinceIso: string) {
  const outbox: any[] = []
  const now = new Date(nowIso)
  const downSince = new Date(downSinceIso)
  const tx: any = {
    $queryRaw: async () => [{ now }],
    heartbeat: { create: async ({ data }: any) => ({ id: 1, ...data }) },
    monitorState: {
      findUnique: async () => ({ status: 0, ping: 0, statusChangedAt: downSince, checkedAt: now, revision: 0n }),
      upsert: async () => ({}),
    },
    notification: { findMany: async () => [{ id: 7 }] },
    notificationDedupe: {
      createManyAndReturn: async ({ data }: any) => data.map((row: any) => ({ key: row.key })),
    },
    notificationOutbox: { createMany: async ({ data }: any) => { outbox.push(...data) } },
  }
  return { tx, outbox }
}

const monitor: any = {
  id: 43, workspaceId: 1, environmentId: 1, name: 'down.example',
  runId: '00000000-0000-4000-8000-000000000002', scheduledFor: new Date(), configVersion: 1,
  interval: 60, responseTimeThreshold: null, resendInterval: 5, expiryNotification: false,
}
const check: any = { status: 0, ping: 0, code: 'CHECK_FAILED', assertionResults: undefined }

describe('resend-while-down alerts', () => {
  it('enqueues a reminder once the interval has elapsed', async () => {
    const { tx, outbox } = makeTx('2026-11-22T00:10:00.000Z', '2026-11-22T00:00:00.000Z')
    await commitMonitorResult(tx, monitor, check)
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0].eventType, 'resend')
    assert.equal(outbox[0].payload.code, 'STILL_DOWN')
    assert.equal(outbox[0].payload.downMinutes, 10)
  })

  it('does not enqueue before the interval', async () => {
    const { tx, outbox } = makeTx('2026-11-22T00:02:00.000Z', '2026-11-22T00:00:00.000Z')
    await commitMonitorResult(tx, monitor, check)
    assert.equal(outbox.length, 0)
  })

  it('does not resend when no interval is configured', async () => {
    const { tx, outbox } = makeTx('2026-11-22T00:10:00.000Z', '2026-11-22T00:00:00.000Z')
    await commitMonitorResult(tx, { ...monitor, resendInterval: 0 }, check)
    assert.equal(outbox.length, 0)
  })
})

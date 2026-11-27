import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { commitMonitorResult } from '../server/services/monitor/commit-result'
import { parseAlertDelayMinutes } from '../server/utils/alert-delay'

function makeTx(nowIso: string, previousStatus: number, delay: string | null) {
  const outbox: any[] = []
  const deleted: any[] = []
  const now = new Date(nowIso)
  const tx: any = {
    $queryRaw: async () => [{ now }],
    heartbeat: { create: async ({ data }: any) => ({ id: 1, ...data }) },
    monitorState: {
      findUnique: async () => ({ status: previousStatus, ping: 0, statusChangedAt: new Date(now.getTime() - 60000), checkedAt: now, revision: 0n }),
      upsert: async () => ({}),
    },
    setting: { findUnique: async () => delay === null ? null : { value: delay } },
    notification: { findMany: async () => [{ id: 7 }] },
    notificationDedupe: { createManyAndReturn: async ({ data }: any) => data.map((row: any) => ({ key: row.key })) },
    notificationOutbox: {
      createMany: async ({ data }: any) => { outbox.push(...data) },
      deleteMany: async (args: any) => { deleted.push(args?.where ?? args) },
    },
  }
  return { tx, outbox, deleted }
}

const monitor: any = {
  id: 44, workspaceId: 1, environmentId: 1, name: 'delay.example',
  runId: '00000000-0000-4000-8000-000000000003', scheduledFor: new Date(), configVersion: 1,
  interval: 60, responseTimeThreshold: null, resendInterval: 0, expiryNotification: false,
}
const down: any = { status: 0, ping: 0, code: 'CHECK_FAILED', assertionResults: undefined }

describe('alert delay', () => {
  it('parses only bounded integers', () => {
    assert.equal(parseAlertDelayMinutes('5'), 5)
    assert.equal(parseAlertDelayMinutes('-1'), 0)
    assert.equal(parseAlertDelayMinutes('9999'), 0)
    assert.equal(parseAlertDelayMinutes('abc'), 0)
  })

  it('schedules a DOWN alert after the configured delay', async () => {
    const { tx, outbox } = makeTx('2026-11-27T00:10:00.000Z', 1, '5')
    await commitMonitorResult(tx, monitor, down)
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0].eventType, 'status')
    assert.equal(outbox[0].status ?? outbox[0].payload.status, 0)
    assert.equal(new Date(outbox[0].nextAttemptAt).toISOString(), '2026-11-27T00:15:00.000Z')
  })

  it('delivers immediately when no delay is configured', async () => {
    const { tx, outbox } = makeTx('2026-11-27T00:10:00.000Z', 1, null)
    await commitMonitorResult(tx, monitor, down)
    assert.equal(new Date(outbox[0].nextAttemptAt).toISOString(), '2026-11-27T00:10:00.000Z')
  })

  it('cancels a pending DOWN alert on recovery', async () => {
    const { tx, deleted } = makeTx('2026-11-27T00:12:00.000Z', 0, '5')
    await commitMonitorResult(tx, monitor, { ...down, status: 1, code: 'CHECK_OK' })
    assert.equal(deleted.length, 1)
    assert.equal(deleted[0].eventType, 'status')
    assert.deepEqual(deleted[0].payload, { path: ['status'], equals: 0 })
  })
})

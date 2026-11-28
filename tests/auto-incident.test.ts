import { test } from 'node:test'
import assert from 'node:assert/strict'
import { syncAutoIncident, autoIncidentEnabled } from '../server/services/monitor/auto-incident'

function makeTx(enabled: boolean, pageId = 5) {
  const incidents: any[] = []
  const updates: any[] = []
  let next = 1
  const tx: any = {
    setting: { findUnique: async () => enabled ? { value: 'true' } : null },
    statusPageGroup: { findMany: async () => [{ statusPageId: pageId }] },
    incident: {
      findMany: async () => incidents.map(row => ({ ...row, updates: updates.filter(u => u.incidentId === row.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 1) })),
      create: async ({ data }: any) => { const row = { id: next++, ...data, pin: data.pin ?? false }; incidents.push(row); return row },
      update: async ({ where, data }: any) => { const row = incidents.find(item => item.id === where.id); Object.assign(row, data); return row },
    },
    incidentUpdate: { create: async ({ data }: any) => { const row = { ...data, createdAt: updates.length + 1 }; updates.push(row); return row } },
  }
  return { tx, incidents, updates }
}

const monitor = { id: 42, name: 'Shop' }
const now = new Date('2026-11-28T09:00:00.000Z')

test('auto incident stays off unless the global setting is true', async () => {
  const { tx, incidents } = makeTx(false)
  assert.equal(await autoIncidentEnabled(tx), false)
  assert.equal(await syncAutoIncident(tx, monitor, 0, now), 0)
  assert.equal(incidents.length, 0)
})

test('DOWN opens an incident once and UP resolves it', async () => {
  const { tx, incidents, updates } = makeTx(true)
  assert.equal(await syncAutoIncident(tx, monitor, 0, now), 1)
  assert.equal(incidents.length, 1)
  assert.equal(incidents[0].statusPageId, 5)
  assert.equal(incidents[0].pin, true)
  assert.equal(updates[0].status, 'investigating')
  assert.equal(await syncAutoIncident(tx, monitor, 0, now), 0) // 已 opened，不再重複（呼叫端只會在狀態變化時呼叫）
  assert.equal(incidents.length, 1)
  assert.equal(await syncAutoIncident(tx, monitor, 1, now), 1)
  assert.equal(incidents[0].pin, false)
  assert.equal(updates.at(-1)?.status, 'resolved')
})

test('a recovered monitor can open a new incident later', async () => {
  const { tx, incidents } = makeTx(true)
  await syncAutoIncident(tx, monitor, 0, now)
  await syncAutoIncident(tx, monitor, 1, now)
  await syncAutoIncident(tx, monitor, 0, now)
  assert.equal(incidents.length, 2)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportDeclarative, planDeclarative, applyDeclarative, declarativeDocumentSchema, DECLARATIVE_VERSION } from '../server/services/monitoring-as-code'

const rows = [
  { name: 'Site A', type: 'browser-flow', url: 'https://user:pass@example.com/a?token=abc', hostname: null, port: null, interval: 3600, timeout: 30, method: 'GET', keyword: null, jsonPath: null, expectedValue: null, ignoreTls: false, upsideDown: false, maxRedirects: 10, active: true, body: '{"steps":[{"action":"goto"}]}', assertions: null, visualConfig: null },
  { name: 'HTTP B', type: 'http', url: 'https://example.org/b', hostname: null, port: null, interval: 60, timeout: 48, method: 'GET', keyword: null, jsonPath: null, expectedValue: null, ignoreTls: false, upsideDown: false, maxRedirects: 10, active: false, body: 'secret request body', assertions: null, visualConfig: null },
]

test('export redacts URL credentials, query values and secret request bodies', async () => {
  const doc = await exportDeclarative({ workspaceId: 1, environmentId: 1 }, {
    monitor: { findMany: async () => rows },
  })
  assert.equal(doc.version, DECLARATIVE_VERSION)
  assert.equal(doc.monitors.length, 2)
  assert.match(doc.monitors[0]!.url || '', /https:\/\/example\.com\/a\?token=%7B%7Bredacted%7D%7D/)
  assert.equal(JSON.stringify(doc).includes('user:pass'), false)
  assert.equal(JSON.stringify(doc).includes('secret request body'), false)
  assert.match(doc.monitors[0]!.body || '', /goto/)
})

test('plan reports create, update and nochange by monitor name', () => {
  const current = { version: DECLARATIVE_VERSION, monitors: [{ name: 'A', type: 'http', interval: 60 }, { name: 'B', type: 'http', interval: 60 }] } as any
  const desired = { version: DECLARATIVE_VERSION, monitors: [{ name: 'A', type: 'http', interval: 120 }, { name: 'B', type: 'http', interval: 60 }, { name: 'C', type: 'ping' }] } as any
  const plan = planDeclarative(current, desired)
  assert.deepEqual(plan.map(action => action.action), ['update', 'nochange', 'create'])
  assert.deepEqual(plan[0]!.changes, ['interval'])
})

test('apply creates and updates monitors atomically with paused defaults', async () => {
  const created: any[] = [], updated: any[] = []
  const tx = {
    monitor: {
      findMany: async () => [{ id: 3, name: 'A' }],
      create: async ({ data }: any) => { created.push(data); return data },
      update: async ({ where, data }: any) => { updated.push({ where, data }); return data },
    },
    $queryRaw: async () => [{ now: new Date('2026-11-28T00:00:00Z') }],
    $queryRawUnsafe: async () => [{ id: 9 }],
  }
  const db = { $transaction: async (fn: any) => fn(tx) }
  const doc = { version: DECLARATIVE_VERSION, monitors: [
    { name: 'A', type: 'http', interval: 120 },
    { name: 'B', type: 'browser-flow', interval: 3600, body: '{"steps":[{"action":"goto"}]}' },
  ] } as any
  const result = await applyDeclarative({ workspaceId: 1, environmentId: 1, user: { id: 1 } }, doc, {}, db)
  assert.deepEqual(result.created, ['B'])
  assert.deepEqual(result.updated, ['A'])
  assert.equal(created[0].active, false)
  assert.equal(created[0].id, 9)
  assert.equal(updated[0].data.interval, 120)
  assert.equal('active' in updated[0].data, false)
})

test('document schema rejects unknown fields and wrong version', () => {
  assert.equal(declarativeDocumentSchema.safeParse({ version: '2.0', monitors: [] }).success, false)
  assert.equal(declarativeDocumentSchema.safeParse({ version: DECLARATIVE_VERSION, monitors: [{ name: 'A', type: 'http', secret: 'x' }] }).success, false)
})

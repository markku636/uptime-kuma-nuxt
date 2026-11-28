import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInvestigationBundle } from '../server/services/monitor/investigation'

function mockDb(monitor: any) {
  return {
    monitor: { findFirst: async () => monitor },
    heartbeat: { findMany: async () => [
      { time: new Date('2026-11-28T08:00:00Z'), status: 0, checkCode: 'HTTP_STATUS', ping: 12, important: true },
      { time: new Date('2026-11-28T07:59:00Z'), status: 1, checkCode: 'CHECK_OK', ping: 10, important: false },
    ] },
    visualCheckArtifact: {
      findMany: async () => [{ checkedAt: new Date('2026-11-28T07:00:00Z'), metrics: { score: 80, grade: 'B', checks: [{ id: 'headers', status: 'fail' }] } }],
      findFirst: async () => ({ checkedAt: new Date('2026-11-28T07:30:00Z'), metrics: { code: 'FLOW_STEP_FAILED' } }),
    },
    notificationOutbox: { findMany: async () => [
      { eventType: 'status', status: 'delivered', attempts: 1, errorCode: null, createdAt: new Date('2026-11-28T08:00:00Z') },
      { eventType: 'status', status: 'dead', attempts: 5, errorCode: 'PROVIDER_FAILED', createdAt: new Date('2026-11-28T07:00:00Z') },
    ] },
  }
}

test('investigation bundle gathers evidence and never exposes secrets', async () => {
  const db = mockDb({ id: 7, name: 'Shop', type: 'http', active: true, interval: 60, url: 'https://user:pass@shop.example.com/path?token=abc', tlsInfo: { daysRemaining: 5, issuer: 'CA', validTo: new Date('2026-12-03'), valid: true } })
  const bundle = await buildInvestigationBundle(7, 1, 1, db)
  assert.ok(bundle)
  assert.equal(bundle.monitor.urlHost, 'shop.example.com')
  assert.equal(bundle.latest?.checkCode, 'HTTP_STATUS')
  assert.equal(bundle.heartbeats.filter(row => row.status === 0).length, 1)
  assert.equal(bundle.tls?.daysRemaining, 5)
  assert.equal(bundle.auditReports[0]?.failedChecks[0], 'headers')
  assert.equal(bundle.browserEvidence.available, true)
  assert.equal(bundle.notifications.length, 2)
  assert.match(bundle.agentHint, /Monitor #7/)
  assert.equal(JSON.stringify(bundle).includes('token=abc'), false)
  assert.equal(JSON.stringify(bundle).includes('user:pass'), false)
})

test('missing monitor returns null', async () => {
  assert.equal(await buildInvestigationBundle(9, 1, 1, { monitor: { findFirst: async () => null } }), null)
})

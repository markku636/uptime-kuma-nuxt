import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkSiteAudit } from '../server/services/monitor/checkers/site-audit-checker'
import { runSiteAudit, type AuditReport } from '../server/services/site-audit/audit'

function report(score: number): AuditReport {
  return {
    url: 'https://example.com', finalUrl: 'https://example.com/', checkedAt: new Date().toISOString(),
    durationMs: 100, score, grade: score >= 90 ? 'A' : score >= 75 ? 'B' : 'C',
    checks: [
      { id: 'http', label: '', status: score >= 60 ? 'pass' : 'fail', summary: '' },
      { id: 'tls', label: '', status: 'pass', summary: '' },
    ],
  }
}

test('site-audit checker maps score to UP and stores it as ping', async () => {
  const result = await checkSiteAudit(
    { url: 'https://example.com', body: JSON.stringify({ minScore: 60 }) },
    Date.now(), undefined, { audit: async () => report(80) },
  )
  assert.equal(result.status, 1)
  assert.equal(result.ping, 80)
  assert.equal(result.code, 'AUDIT_OK')
  assert.match(result.msg, /80\/100/)
})

test('site-audit checker fails below threshold and lists failed checks', async () => {
  const result = await checkSiteAudit(
    { url: 'https://example.com', body: JSON.stringify({ minScore: 60 }) },
    Date.now(), undefined, { audit: async () => report(20) },
  )
  assert.equal(result.status, 0)
  assert.equal(result.ping, 20)
  assert.equal(result.code, 'AUDIT_LOW')
  assert.match(result.msg, /fail: http/)
})

test('site-audit config in body can override the monitor URL and reject bad config', async () => {
  let seen = ''
  const result = await checkSiteAudit(
    { url: 'https://ignored.example', body: JSON.stringify({ url: 'https://used.example', minScore: 10 }) },
    Date.now(), undefined, { audit: async input => { seen = input.url; return report(90) } },
  )
  assert.equal(seen, 'https://used.example')
  assert.equal(result.status, 1)
  const bad = await checkSiteAudit({ url: 'https://example.com', body: '{oops' }, Date.now())
  assert.equal(bad.code, 'CONFIG_ERROR')
  assert.equal(typeof runSiteAudit, 'function')
})

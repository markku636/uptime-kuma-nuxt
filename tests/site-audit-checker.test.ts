import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkSiteAudit, redactAuditReport } from '../server/services/monitor/checkers/site-audit-checker'
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

test('report redaction strips credentials, query strings and linked URLs', () => {
  const original = report(90)
  original.url = 'https://user:secret@example.com/path?token=abc'
  original.finalUrl = 'https://example.com/final?key=xyz#frag'
  original.checks[0]!.detail = ['重新導向至 https://user:pw@example.com/next?token=abc', '缺少 HSTS']
  const clean = redactAuditReport(original)
  assert.equal(clean.url, 'https://example.com/path')
  assert.equal(clean.finalUrl, 'https://example.com/final')
  assert.equal(clean.checks[0]!.detail?.[0], '重新導向至 https://example.com/next')
  assert.equal(clean.checks[0]!.detail?.[1], '缺少 HSTS')
})

test('scheduled checks save redacted reports but trials do not', async () => {
  const saved: any[] = []
  const deps = { audit: async () => report(88), saveReport: async (id: number, r: AuditReport) => { saved.push({ id, r }) } }
  await checkSiteAudit({ id: 9, url: 'https://example.com' }, Date.now(), undefined, deps)
  assert.equal(saved.length, 1)
  assert.equal(saved[0].id, 9)
  await checkSiteAudit({ id: 9, url: 'https://example.com', includeTrialResponse: true }, Date.now(), undefined, deps)
  assert.equal(saved.length, 1)
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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkSecurityScan, redactSecurityReport } from '../server/services/monitor/checkers/security-scan-checker'
import type { SecurityScanReport } from '../shared/types/security-scan'

function report(score: number): SecurityScanReport {
  return {
    url: 'https://example.com', finalUrl: 'https://example.com/', host: 'example.com',
    profile: 'passive', checkedAt: new Date().toISOString(), durationMs: 100,
    score, grade: score >= 90 ? 'A' : 'C', riskLevel: score >= 90 ? 'none' : 'medium',
    findings: score >= 90 ? [] : [{
      key: 'headers.csp.missing|https://example.com/|', rule: 'headers.csp.missing',
      category: 'headers', severity: 'medium', title: '缺少 CSP', detail: '沒有 CSP',
      recommendation: '加 CSP', location: { url: 'https://example.com/' },
      evidence: {}, cwe: [], refs: [], tags: [],
    }],
    fingerprint: { status: 200, title: 'Demo', server: null, technologies: [], finalUrl: 'https://example.com/', redirects: 0 },
    warnings: [], limits: { maxProbes: 6, probesUsed: 0, maxFindings: 100 },
  }
}

test('security-scan checker maps score to UP and stores it as ping', async () => {
  const result = await checkSecurityScan(
    { url: 'https://example.com', body: JSON.stringify({ minScore: 60 }) },
    Date.now(), undefined, { scan: async () => report(80) },
  )
  assert.equal(result.status, 1)
  assert.equal(result.ping, 80)
  assert.equal(result.code, 'SCAN_OK')
  assert.match(result.msg, /80\/100/)
  assert.match(result.msg, /top: 缺少 CSP/)
})

test('security-scan checker fails below threshold', async () => {
  const result = await checkSecurityScan(
    { url: 'https://example.com', body: JSON.stringify({ minScore: 60 }) },
    Date.now(), undefined, { scan: async () => report(20) },
  )
  assert.equal(result.status, 0)
  assert.equal(result.ping, 20)
  assert.equal(result.code, 'SCAN_LOW')
})

test('redaction strips credentials, query strings and linked URLs', () => {
  const original = report(50)
  original.url = 'https://user:secret@example.com/path?token=abc'
  original.finalUrl = 'https://example.com/final?key=xyz#frag'
  original.findings[0]!.detail = '導向 https://user:pw@example.com/next?token=abc'
  original.findings[0]!.location.url = 'https://example.com/page?sig=abc'
  original.warnings.push('FETCH https://example.com/x?token=abc')
  const clean = redactSecurityReport(original)
  assert.equal(clean.url, 'https://example.com/path')
  assert.equal(clean.finalUrl, 'https://example.com/final')
  assert.equal(clean.findings[0]!.detail, '導向 https://example.com/next')
  assert.equal(clean.findings[0]!.location.url, 'https://example.com/page')
  assert.ok(!clean.warnings[0]!.includes('token=abc'))
})

test('scheduled checks save redacted reports but trials do not', async () => {
  const saved: any[] = []
  const deps = { scan: async () => report(88), saveReport: async (id: number, r: SecurityScanReport) => { saved.push({ id, r }) } }
  await checkSecurityScan({ id: 9, url: 'https://example.com' }, Date.now(), undefined, deps)
  assert.equal(saved.length, 1)
  await checkSecurityScan({ id: 9, url: 'https://example.com', includeTrialResponse: true }, Date.now(), undefined, deps)
  assert.equal(saved.length, 1)
})

test('bad config and missing URL return CONFIG_ERROR', async () => {
  const bad = await checkSecurityScan({ url: 'https://example.com', body: '{oops' }, Date.now(), undefined, { scan: async () => report(90) })
  assert.equal(bad.code, 'CONFIG_ERROR')
  const missing = await checkSecurityScan({}, Date.now(), undefined, { scan: async () => report(90) })
  assert.equal(missing.code, 'CONFIG_ERROR')
})

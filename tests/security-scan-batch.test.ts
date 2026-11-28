import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBatchSecurityScan, MAX_BATCH_URLS } from '../server/services/security-scan/batch'
import type { SecurityScanReport } from '../shared/types/security-scan'

function report(url: string, score: number): SecurityScanReport {
  return {
    url, finalUrl: url, host: 'example.com', profile: 'passive',
    checkedAt: new Date().toISOString(), durationMs: 10, score,
    grade: score >= 90 ? 'A' : 'C', riskLevel: score >= 90 ? 'none' : 'medium',
    findings: score >= 90 ? [] : [{
      key: 'x|' + url + '|', rule: 'x', category: 'headers', severity: 'medium',
      title: 't', detail: '', recommendation: '', location: { url }, evidence: {}, cwe: [], refs: [], tags: [],
    }],
    fingerprint: { status: 200, title: null, server: null, technologies: [], finalUrl: url, redirects: 0 },
    warnings: [], limits: { maxProbes: 6, probesUsed: 0, maxFindings: 100 },
  }
}

test('batch 保留順序並統計 healthy / low / error', async () => {
  const urls = ['https://a.example', 'https://b.example', 'https://c.example']
  const result = await runBatchSecurityScan(urls, async ({ url }) => {
    if (url.includes('/b.')) throw new Error('boom')
    return report(url, url.includes('/a.') ? 95 : 40)
  })
  assert.deepEqual(result.results.map(row => row.url), urls)
  assert.equal(result.results[0]!.score, 95)
  assert.equal(result.results[1]!.status, 'error')
  assert.match(result.results[1]!.error || '', /boom/)
  assert.equal(result.results[2]!.score, 40)
  assert.equal(result.passed, 1)
  assert.equal(result.failed, 1)
  assert.equal(result.errors, 1)
})

test('batch 併發有界（最多 3）', async () => {
  let active = 0, peak = 0
  const urls = Array.from({ length: 12 }, (_, i) => `https://s${i}.example`)
  await runBatchSecurityScan(urls, async ({ url }) => {
    active++
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    return report(url, 90)
  })
  assert.ok(peak <= 3, `peak concurrency was ${peak}`)
  assert.equal(peak, 3)
})

test('batch 上限常數為 20', () => {
  assert.equal(MAX_BATCH_URLS, 20)
})

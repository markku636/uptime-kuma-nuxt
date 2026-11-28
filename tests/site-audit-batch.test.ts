import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBatchAudit } from '../server/services/site-audit/batch'
import type { AuditReport } from '../server/services/site-audit/audit'

function fakeReport(url: string, score: number): AuditReport {
  return {
    url, finalUrl: url, checkedAt: new Date().toISOString(), durationMs: 12, score,
    grade: score >= 90 ? 'A' : score >= 60 ? 'B' : 'F',
    checks: [{ id: 'http', label: '', status: score >= 60 ? 'pass' : 'fail', summary: '' }],
  }
}

test('batch audit keeps input order and summarises findings', async () => {
  const result = await runBatchAudit(
    ['https://a.example', 'https://b.example', 'https://c.example'], undefined,
    async ({ url }) => fakeReport(url, url.includes('b') ? 40 : 90), 2,
  )
  assert.deepEqual(result.results.map(row => row.url), ['https://a.example', 'https://b.example', 'https://c.example'])
  assert.deepEqual([result.passed, result.failed, result.errors], [2, 1, 0])
  assert.deepEqual(result.results[1]!.failedChecks, ['http'])
})

test('batch audit forwards expectedStatus to every URL', async () => {
  const seen: number[] = []
  await runBatchAudit(['https://a.example', 'https://b.example'], undefined, async input => {
    seen.push(input.expectedStatus ?? 0)
    return fakeReport(input.url, 90)
  }, 2, undefined, 404)
  assert.deepEqual(seen, [404, 404])
})

test('batch audit isolates a failing URL from the rest', async () => {
  const result = await runBatchAudit(['https://a.example', 'https://bad.example'], undefined, async ({ url }) => {
    if (url.includes('bad')) throw new Error('DESTINATION_DENIED')
    return fakeReport(url, 80)
  })
  assert.equal(result.results[0]!.status, 'ok')
  assert.equal(result.results[1]!.status, 'error')
  assert.equal(result.results[1]!.error, 'DESTINATION_DENIED')
  assert.deepEqual([result.passed, result.failed, result.errors], [1, 0, 1])
})

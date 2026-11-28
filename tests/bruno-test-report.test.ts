import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reportToHtml, reportToCsv } from '../server/services/bruno/test-report'

const report = {
  id: '12', suiteId: 3, status: 'fail',
  startedAt: new Date('2026-11-29T00:00:00Z'), finishedAt: new Date('2026-11-29T00:00:01Z'),
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, durationMs: 1000, extractedNames: [] },
  steps: [{
    stepIndex: 0, path: 'a.bru', name: '<script>alert(1)</script>', method: 'GET', status: 'fail',
    httpStatus: 500, elapsedMs: 12, errorCode: null,
    assertions: { passed: false, rules: [{ ruleId: 'bruno-1', source: 'status', operator: 'equals', passed: false, reason: 'value_mismatch', actual: '<img src=x>' }] },
    extractedNames: [],
  }],
}

test('HTML report is self-contained and escapes every dynamic value', () => {
  const html = reportToHtml(report as any)
  assert.ok(html.startsWith('<!doctype html>'))
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img src=x>'))
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(html.includes('&lt;img src=x&gt;'))
})

test('CSV report keeps a single row per step with escaped cells', () => {
  const csv = reportToCsv(report as any)
  assert.equal(csv.trim().split('\r\n').length, 2)
  assert.ok(csv.includes('<script>alert(1)</script>'))
  assert.ok(csv.includes('"<script>alert(1)</script>"'))
})

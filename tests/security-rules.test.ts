import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareVersion, ruleFindings } from '../server/services/security-scan/scan'
import catalog from '../server/services/security-scan/catalog.json'
import type { SecurityRule } from '../shared/types/security-scan'

test('open-source catalog rules carry a traceable source', () => {
  assert.ok(catalog.length >= 5)
  for (const rule of catalog) {
    assert.ok(rule.source)
    assert.ok(rule.sourceUrl.startsWith('https://'))
  }
})

test('version comparison is numeric and bounded', () => {
  assert.equal(compareVersion('3.5.0', '3.5.1'), -1)
  assert.equal(compareVersion('3.5.1', '3.5.1'), 0)
  assert.equal(compareVersion('2.0.0', '1.9.9'), 1)
})

test('rules match safe string signatures and only vulnerable versions', () => {
  const rules = catalog as SecurityRule[]
  const hit = ruleFindings({ status: 200, headers: {}, body: '<script src="/js/jquery-3.4.1.min.js"></script>', elapsed: 1,
    finalUrl: 'https://example.com', tlsInfo: null, redirectChain: [] }, rules, 'https://example.com')
  assert.ok(hit.some(finding => finding.rule === 'vuln.nvd-jquery-xss-2020'))
  const safe = ruleFindings({ status: 200, headers: {}, body: '<script src="/js/jquery-3.6.0.min.js"></script>', elapsed: 1,
    finalUrl: 'https://example.com', tlsInfo: null, redirectChain: [] }, rules, 'https://example.com')
  assert.ok(!safe.some(finding => finding.rule === 'vuln.nvd-jquery-xss-2020'))
  assert.ok(hit.every(finding => finding.evidence.source && finding.evidence.sourceUrl))
})

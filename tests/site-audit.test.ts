import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkSecurityHeaders, parsePageMeta, extractLinks, scoreChecks, runSiteAudit,
  type AuditFetcher, type AuditFetchResult,
} from '../server/services/site-audit/audit'

const secureHeaders = {
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=()',
}

test('security headers: all present on HTTPS passes, HSTS is not required on HTTP', () => {
  assert.equal(checkSecurityHeaders(secureHeaders, true).status, 'pass')
  const withoutHsts = { ...secureHeaders }
  delete withoutHsts['strict-transport-security']
  assert.equal(checkSecurityHeaders(withoutHsts, true).status, 'warn')
  assert.equal(checkSecurityHeaders(withoutHsts, false).status, 'pass')
})

test('security headers: three or more missing becomes fail', () => {
  const result = checkSecurityHeaders({}, true)
  assert.equal(result.status, 'fail')
  assert.equal(result.detail?.length, 6)
})

test('page metadata parses title, description, viewport, lang and noindex', () => {
  const meta = parsePageMeta('<html lang="zh-TW"><head><title>Hello</title><meta name="description" content="Demo site"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex, follow"></head></html>')
  assert.equal(meta.title, 'Hello')
  assert.equal(meta.description, 'Demo site')
  assert.equal(meta.viewport, true)
  assert.equal(meta.lang, 'zh-TW')
  assert.equal(meta.noIndex, true)
})

test('local links only: external, mailto and javascript are ignored and duplicates removed', () => {
  const html = '<a href="/a">A</a><a href="https://example.com/a">dup</a><a href="https://other.test/x">ext</a><a href="mailto:x@y.z">mail</a><img src="/logo.png"><script src="https://example.com/app.js"></script>'
  const links = extractLinks(html, 'https://example.com/page')
  assert.deepEqual(links, ['https://example.com/a', 'https://example.com/logo.png', 'https://example.com/app.js'])
})

test('score checks maps statuses to 0-100 score and grade', () => {
  const perfect = scoreChecks([
    { id: 'http', label: '', status: 'pass', summary: '' },
    { id: 'tls', label: '', status: 'pass', summary: '' },
    { id: 'dns', label: '', status: 'pass', summary: '' },
    { id: 'keyword', label: '', status: 'skip', summary: '' },
  ])
  assert.deepEqual(perfect, { score: 100, grade: 'A' })
  const broken = scoreChecks([
    { id: 'http', label: '', status: 'fail', summary: '' },
    { id: 'tls', label: '', status: 'fail', summary: '' },
    { id: 'dns', label: '', status: 'fail', summary: '' },
    { id: 'keyword', label: '', status: 'fail', summary: '' },
  ])
  assert.equal(broken.score, 13)
  assert.equal(broken.grade, 'F')
})

const pageHtml = '<html lang="en"><head><title>Example</title><meta name="description" content="Demo"><meta name="viewport" content="width=device-width"></head><body>Welcome home<a href="/ok">ok</a></body></html>'
function fakeFetcher(overrides: Partial<AuditFetchResult> = {}): AuditFetcher {
  return async (url, method) => ({
    status: 200, headers: { 'content-type': 'text/html', ...secureHeaders },
    body: method === 'GET' ? pageHtml : '', elapsed: 12, finalUrl: url,
    tlsInfo: {
      valid: true, issuer: 'CN=Test CA', subject: '', validFrom: new Date('2026-01-01'),
      validTo: new Date('2027-01-01'), daysRemaining: 60, fingerprint: '', serialNumber: '',
      subjectAltName: ['example.com'],
    },
    ...overrides,
  })
}
const fakeLookup = (async () => [{ address: '93.184.216.34', family: 4 }]) as any

test('site audit produces a full report with a keyword check', async () => {
  const report = await runSiteAudit({ url: 'https://example.com/', keyword: 'Welcome' }, { fetcher: fakeFetcher(), lookupFn: fakeLookup })
  assert.equal(report.url, 'https://example.com/')
  assert.equal(report.grade, 'A')
  const byId = Object.fromEntries(report.checks.map(check => [check.id, check.status]))
  assert.deepEqual(byId, { http: 'pass', tls: 'pass', dns: 'pass', headers: 'pass', meta: 'pass', links: 'pass', keyword: 'pass' })
})

test('site audit reports failures and does not throw on network errors', async () => {
  const report = await runSiteAudit({ url: 'https://example.com/', keyword: 'missing-word' }, {
    fetcher: fakeFetcher({ status: 503, body: '', headers: {} }),
    lookupFn: fakeLookup,
  })
  assert.equal(report.score < 60, true)
  const byId = Object.fromEntries(report.checks.map(check => [check.id, check.status]))
  assert.equal(byId.http, 'fail')
  assert.equal(byId.keyword, 'fail')
  assert.equal(byId.headers, 'fail')
})

test('expectedStatus overrides the default 2xx gate', async () => {
  const ok = await runSiteAudit({ url: 'https://example.com/', expectedStatus: 503 }, { fetcher: fakeFetcher({ status: 503 }), lookupFn: fakeLookup })
  assert.equal(ok.checks.find(check => check.id === 'http')?.status, 'pass')
  assert.match(ok.checks.find(check => check.id === 'http')?.summary || '', /expected 503/)
  const bad = await runSiteAudit({ url: 'https://example.com/', expectedStatus: 404 }, { fetcher: fakeFetcher({ status: 503 }), lookupFn: fakeLookup })
  assert.equal(bad.checks.find(check => check.id === 'http')?.status, 'fail')
})

test('site audit honours disabled checks without scoring them', async () => {
  const report = await runSiteAudit({
    url: 'https://example.com/',
    checks: { tls: false, dns: false, headers: false, meta: false, links: false, keyword: false },
  }, { fetcher: fakeFetcher({ status: 503, body: '', headers: {} }), lookupFn: fakeLookup })
  const byId = Object.fromEntries(report.checks.map(check => [check.id, check.status]))
  assert.deepEqual(byId, { http: 'fail', tls: 'skip', dns: 'skip', headers: 'skip', meta: 'skip', links: 'skip', keyword: 'skip' })
  const allPass = await runSiteAudit({ url: 'https://example.com/' }, { fetcher: fakeFetcher(), lookupFn: fakeLookup })
  assert.equal(allPass.score > report.score, true)
})

test('site audit skips TLS for plain HTTP', async () => {
  const fetcher = fakeFetcher({ finalUrl: 'http://example.com/', tlsInfo: null })
  const report = await runSiteAudit({ url: 'http://example.com/' }, { fetcher, lookupFn: fakeLookup })
  assert.equal(report.checks.find(check => check.id === 'tls')?.status, 'skip')
})

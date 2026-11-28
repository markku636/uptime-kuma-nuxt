import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AuditFetchResult, AuditFetcher } from '../server/services/site-audit/audit'
import { runSecurityScan, scoreFindings, resolveAuditFetcher, SEVERITY_RANK } from '../server/services/security-scan/scan'
import { defaultAuditFetcher } from '../server/services/site-audit/audit'
import type { SecurityFinding } from '../shared/types/security-scan'
import { lookup, resolveMx, resolveTxt } from 'node:dns/promises'

const secureHeaders = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy': "default-src 'self'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), geolocation=()',
}

function page(overrides: Partial<AuditFetchResult> = {}): AuditFetchResult {
  return {
    status: 200, headers: { ...secureHeaders }, body: '<html lang="en"><head><title>Demo</title></head><body>ok</body></html>',
    elapsed: 12, finalUrl: 'https://example.com/', tlsInfo: null, redirectChain: [],
    ...overrides,
  }
}

const fakeLookup = (async () => [{ address: '93.184.216.34', family: 4 }]) as unknown as typeof lookup
const noTxt = (async () => { throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' }) }) as unknown as typeof resolveTxt
const noLegacyTls = async () => ({ legacy: false, errors: [] })
const withMx = (async () => [{ exchange: 'mail.example.com', priority: 10 }]) as unknown as typeof resolveMx
const fakeTxt = (records: Record<string, string[]>) => (async (name: string) => {
  if (!records[name]) throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' })
  return records[name]!.map(value => [value])
}) as unknown as typeof resolveTxt

function finding(rule: string, severity: SecurityFinding['severity']): SecurityFinding {
  return {
    key: rule, rule, category: 'headers', severity, title: rule, detail: '', recommendation: '',
    location: { url: 'https://example.com/' }, evidence: {}, cwe: [], refs: [], tags: [],
  }
}

test('被動掃描：缺少標頭與 DMARC 會產生 finding，分數低於 100 且微調項目為 info/low', async () => {
  const fetcher: AuditFetcher = async () => page({ headers: { 'content-type': 'text/html' } })
  const report = await runSecurityScan({ url: 'https://example.com/' }, {
    fetcher, lookupFn: fakeLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls,
  })
  assert.equal(report.profile, 'passive')
  assert.ok(report.score < 100)
  assert.ok(report.findings.some(f => f.rule === 'headers.csp.missing'))
  assert.ok(report.findings.some(f => f.rule === 'dns.dmarc.missing'))
  assert.ok(report.warnings.some(w => w.startsWith('EXPOSURE_SKIPPED')))
  assert.equal(report.limits.probesUsed, 0)
  assert.equal(report.findings[0]!.severity, 'medium')
  // 依嚴重度排序
  for (let i = 1; i < report.findings.length; i++) {
    assert.ok(SEVERITY_RANK[report.findings[i - 1]!.severity] >= SEVERITY_RANK[report.findings[i]!.severity])
  }
})

test('未驗證擁有權時 active_light 自動降級，不送出探測請求', async () => {
  const calls: string[] = []
  const fetcher: AuditFetcher = async (url, method) => { calls.push(`${method} ${url}`); return page() }
  const report = await runSecurityScan({ url: 'https://example.com/', profile: 'active_light' }, {
    fetcher, lookupFn: fakeLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls,
  })
  assert.equal(report.profile, 'passive')
  assert.equal(report.limits.probesUsed, 0)
  assert.ok(report.warnings.some(w => w.startsWith('OWNERSHIP_UNVERIFIED')))
  assert.ok(!calls.some(call => call.includes('/.env')))
})

test('已驗證擁有權才跑 active_light 探測，且只送出允許的少數路徑', async () => {
  const calls: string[] = []
  const fetcher: AuditFetcher = async (url, method) => {
    calls.push(`${method} ${url}`)
    if (url.includes('/.env')) return page({ status: 200, headers: { 'content-type': 'text/plain' }, body: '' })
    return page({ status: 404, headers: { 'content-type': 'text/html' }, body: '' })
  }
  const report = await runSecurityScan({ url: 'https://example.com/', profile: 'active_light', maxProbes: 2 }, {
    fetcher, lookupFn: fakeLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls,
    verifyOwnership: async () => true,
  })
  assert.equal(report.profile, 'active_light')
  assert.equal(report.limits.probesUsed, 2)
  assert.ok(report.findings.some(f => f.rule === 'exposure._env'))
  assert.equal(calls.filter(call => call.startsWith('HEAD')).length, 2)
})

test('SSRF：私人／metadata 位址在送出任何請求前就被擋下', async () => {
  let called = false
  const fetcher: AuditFetcher = async () => { called = true; return page() }
  const privateLookup = (async () => [{ address: '127.0.0.1', family: 4 }]) as unknown as typeof lookup
  await assert.rejects(runSecurityScan({ url: 'http://example.com/' }, {
    fetcher, lookupFn: privateLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls,
  }), /DESTINATION_DENIED/)
  assert.equal(called, false)
})

test('TLS 過期為 critical，即將過期為 high；jQuery 舊版有 CVE 參考', async () => {
  const tls = {
    valid: false, issuer: 'Demo CA', subject: 'CN=example.com',
    validFrom: new Date('2020-01-01'), validTo: new Date('2020-02-01'), daysRemaining: -2000,
    fingerprint: 'aa', serialNumber: 'bb', subjectAltName: ['example.com'],
  }
  const report = await runSecurityScan({
    url: 'https://example.com/',
    categories: { dns: false },
  }, {
    fetcher: async () => page({
      tlsInfo: tls,
      body: '<html><script src="/jquery-3.4.1.min.js"></script></html>',
    }),
    lookupFn: fakeLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls,
  })
  assert.equal(report.findings.find(f => f.rule === 'tls.cert.expired')?.severity, 'critical')
  const jquery = report.findings.find(f => f.rule === 'fingerprint.jquery.outdated')
  assert.equal(jquery?.severity, 'high')
  assert.ok(jquery?.refs.some(ref => ref.includes('CVE-2020-11022')))
  assert.equal(report.riskLevel, 'critical')
})

test('沒有 MX 的網站不誤報缺 SPF／DMARC', async () => {
  const noMx = (async () => []) as unknown as typeof resolveMx
  const report = await runSecurityScan({ url: 'https://example.com/' }, {
    fetcher: async () => page(), lookupFn: fakeLookup, resolveTxtFn: noTxt,
    resolveMxFn: noMx, tlsProber: noLegacyTls,
  })
  assert.ok(!report.findings.some(f => f.rule === 'dns.spf.missing'))
  assert.ok(!report.findings.some(f => f.rule === 'dns.dmarc.missing'))
  assert.ok(report.warnings.some(w => w.startsWith('DNS_MAIL_SKIPPED')))
})

test('DNS 已有 SPF/DMARC 時不產生相對應 finding', async () => {
  const report = await runSecurityScan({ url: 'https://example.com/' }, {
    fetcher: async () => page(), lookupFn: fakeLookup,
    resolveTxtFn: fakeTxt({ 'example.com': ['v=spf1 -all'], '_dmarc.example.com': ['v=DMARC1; p=reject'] }), resolveMxFn: withMx, tlsProber: noLegacyTls,
  })
  assert.ok(!report.findings.some(f => f.rule === 'dns.spf.missing'))
  assert.ok(!report.findings.some(f => f.rule === 'dns.dmarc.missing'))
})

test('categories 可關閉整類檢查', async () => {
  const report = await runSecurityScan({
    url: 'https://example.com/',
    categories: { headers: false, cookies: false, tls: false, dns: false, fingerprint: false, redirect: false, exposure: false },
  }, { fetcher: async () => page({ headers: {} }), lookupFn: fakeLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls })
  assert.deepEqual(report.findings, [])
  assert.equal(report.score, 100)
  assert.equal(report.grade, 'A')
})

test('沒有注入 fetcher 時使用真正的 site-audit fetcher（避免 NO_FETCHER 空報告）', () => {
  assert.equal(resolveAuditFetcher({}), defaultAuditFetcher)
  const injected: AuditFetcher = async () => page()
  assert.equal(resolveAuditFetcher({ fetcher: injected }), injected)
})

test('TLS 探測到舊協定時給 high finding，modern 時不給', async () => {
  const legacy = await runSecurityScan({ url: 'https://example.com/', categories: { dns: false } }, {
    fetcher: async () => page(), lookupFn: fakeLookup, resolveTxtFn: noTxt,
    tlsProber: async () => ({ legacy: true, errors: [] }),
  })
  const finding = legacy.findings.find(f => f.rule === 'tls.protocol.legacy')
  assert.equal(finding?.severity, 'high')
  assert.ok(finding?.refs.some(ref => ref.includes('rfc8996')))
  const modern = await runSecurityScan({ url: 'https://example.com/', categories: { dns: false } }, {
    fetcher: async () => page(), lookupFn: fakeLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls,
  })
  assert.ok(!modern.findings.some(f => f.rule === 'tls.protocol.legacy'))
})

test('SameSite=None 但沒有 Secure 的 cookie 單獨列為 high', async () => {
  const report = await runSecurityScan({ url: 'https://example.com/', categories: { dns: false, tls: false } }, {
    fetcher: async () => page({
      headers: { ...secureHeaders, 'set-cookie': 'session=abc; Path=/; HttpOnly; SameSite=None' },
    }),
    lookupFn: fakeLookup, resolveTxtFn: noTxt, resolveMxFn: withMx, tlsProber: noLegacyTls,
  })
  const finding = report.findings.find(f => f.rule === 'cookies.samesite_none_without_secure')
  assert.equal(finding?.severity, 'high')
  assert.equal(finding?.location.param, 'session')
})

test('scoreFindings 依嚴重度扣分並給風險等級', () => {
  const clean = scoreFindings([])
  assert.deepEqual(clean, { score: 100, grade: 'A', riskLevel: 'none' })
  const risky = scoreFindings([finding('a', 'critical'), finding('b', 'high'), finding('c', 'low')])
  assert.equal(risky.score, 54)
  assert.equal(risky.grade, 'D')
  assert.equal(risky.riskLevel, 'critical')
})

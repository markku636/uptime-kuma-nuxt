// server/services/security-scan/scan.ts
// 網站弱點／滲透檢查引擎。設計參考 markku636/ai-security-monitor 的 webscan：
//   - 兩層 profile：passive（瀏覽器等級請求）／active_light（需驗證擁有權才做的安全探測）
//   - finding 格式仿 OCSF：severity / rule / key / recommendation / location / evidence / cwe / refs / tags
//   - 不做注入、模糊測試、DoS；不送資料給第三方；所有請求都強制 deny 私網／metadata 位址。
// 被動指紋的結果只陳述「看到什麼版本」，不聲稱未經驗證的 CVE；內建的小目錄才給 CVE 參考。

import { lookup, resolveTxt } from 'node:dns/promises'
import { isIP } from 'node:net'
import type {
  SecurityFinding, SecurityScanCategory, SecurityScanInput, SecurityScanProfile,
  SecurityScanReport, SecurityScanSeverity, SecurityScanFingerprint,
} from '../../../shared/types/security-scan'
import { SECURITY_SCAN_SEVERITIES } from '../../../shared/types/security-scan'
import type { AuditFetchResult, AuditFetcher } from '../site-audit/audit'
import { defaultAuditFetcher } from '../site-audit/audit'
import { defaultTlsProber, type TlsProber } from './tls-probe'
import { HttpCheckError, isForbiddenAddress } from '../monitor/checkers/http-request'

export { SECURITY_SCAN_SEVERITIES }

export const SEVERITY_RANK: Record<SecurityScanSeverity, number> = {
  info: 0, low: 1, medium: 2, high: 3, critical: 4,
}
const PENALTY: Record<SecurityScanSeverity, number> = {
  info: 0, low: 2, medium: 6, high: 14, critical: 30,
}
const MAX_FINDINGS = 100
const MAX_PROBES = 6
const METADATA_HOSTS = new Set(['metadata.google.internal', 'metadata.google', 'instance-data.ec2.internal', 'metadata.azure.internal'])

export interface SecurityScanDeps {
  fetcher?: AuditFetcher
  lookupFn?: typeof lookup
  resolveTxtFn?: typeof resolveTxt
  /** 由 API 注入：只有持有該 host 的驗證 token 才回 true。引擎本身不信任 input.verify。 */
  verifyOwnership?: (input: SecurityScanInput) => Promise<boolean>
  /** TLS 版本探測；可注入以便測試，不注入時用釘 IP 的 handshake。 */
  tlsProber?: TlsProber
  now?: Date
}

type FindingInput = Omit<SecurityFinding, 'key'>

function normalizedHost(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
}

function clip(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.slice(0, max) : value == null ? '' : String(value).slice(0, max)
}

/** 與 site-audit 相同的 protection：即使一般 HTTP checker 允許私網，弱點檢查也永遠不准打內網。 */
async function assertPublicDestination(url: URL, lookupFn: typeof lookup): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 8192) throw new HttpCheckError('CONFIG_ERROR')
  const host = normalizedHost(url)
  if (!host || METADATA_HOSTS.has(host) || url.username || url.password) throw new HttpCheckError('DESTINATION_DENIED')
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookupFn(host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address, false))) throw new HttpCheckError('DESTINATION_DENIED')
}

function hostMatches(certNames: string[], host: string): boolean {
  if (!certNames.length) return true
  return certNames.some(name => name === host || name.startsWith('*.') && host.endsWith(name.slice(1)))
}

/** 只收錄能在公開文件查到、且可從被動指紋可靠判定的舊版本；其餘版本只回「資訊揭露」。 */
const VERSION_RULES: Array<{
  id: string
  pattern: RegExp
  vulnerable: (version: string) => boolean
  severity: SecurityScanSeverity
  title: string
  cve?: string
  refs: string[]
}> = [
  {
    id: 'fingerprint.jquery.outdated',
    pattern: /jquery[-/]v?(\d+)\.(\d+)(?:\.(\d+))?/i,
    vulnerable: (version) => {
      const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number)
      return major < 3 || major === 3 && (minor < 5 || minor === 5 && patch < 1)
    },
    severity: 'high',
    title: '疑似使用含已知 XSS 漏洞的舊版 jQuery',
    cve: 'CVE-2020-11022 / CVE-2020-11023',
    refs: ['https://nvd.nist.gov/vuln/detail/CVE-2020-11022', 'https://jquery.com/download/'],
  },
]

function fingerprintFrom(page: AuditFetchResult, inputUrl: string): { fingerprint: SecurityScanFingerprint; findings: FindingInput[] } {
  const headers = Object.fromEntries(Object.entries(page.headers).map(([key, value]) => [key.toLowerCase(), value]))
  const html = page.body.slice(0, 262144)
  const title = /<title[^>]*>([\s\S]{1,300}?)<\/title>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, '').trim() || null
  const technologies: string[] = []
  const findings: FindingInput[] = []
  const addTech = (name: string) => { if (!technologies.includes(name)) technologies.push(name) }

  if (/__NEXT_DATA__|_next\/static/i.test(html)) addTech('Next.js')
  if (/wp-content\/|wp-includes\//i.test(html)) addTech('WordPress')
  if (/id="__nuxt"|__NUXT__/i.test(html)) addTech('Nuxt')
  if (/<script[^>]+src="[^"]*\/vue(?:\.min)?\.js/i.test(html)) addTech('Vue')
  if (/react|react-dom/i.test(html) && !technologies.includes('Next.js')) addTech('React')
  if (/(?:asp\.net|__VIEWSTATE)/i.test(html)) addTech('ASP.NET')

  const disclosed: string[] = []
  for (const [header, label] of [['server', 'Server'], ['x-powered-by', 'X-Powered-By'], ['x-aspnet-version', 'X-AspNet-Version'], ['x-generator', 'X-Generator']] as const) {
    if (headers[header]) {
      disclosed.push(`${label}: ${clip(headers[header], 120)}`)
      addTech(label)
    }
  }
  if (disclosed.length) findings.push({
    rule: 'fingerprint.version_disclosure', category: 'fingerprint', severity: 'info',
    title: '回應標頭揭露技術或版本', detail: disclosed.join('；'),
    recommendation: '移除或遮蔽 Server / X-Powered-By / X-AspNet-Version 等工作階段標頭，降低針對性攻擊的成功率。',
    location: { url: inputUrl }, evidence: { headers: disclosed.join('；') },
    cwe: ['CWE-200'], refs: ['https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/08-Fingerprint_Web_Server'], tags: ['passive', 'recon'],
  })

  for (const rule of VERSION_RULES) {
    const match = rule.pattern.exec(html) || rule.pattern.exec(Object.values(headers).join(' '))
    if (!match?.[1] || !rule.vulnerable(match[1])) continue
    findings.push({
      rule: rule.id, category: 'fingerprint', severity: rule.severity,
      title: rule.title, detail: `從頁面／標頭識別到版本 ${match[1]}；${rule.cve || '舊版本'}。`,
      recommendation: '升級到該專案目前支援的修補版本，並重新掃描確認版本已更新。',
      location: { url: inputUrl }, evidence: { version: match[1], source: 'fingerprint' },
      cwe: ['CWE-1104'], refs: rule.refs, tags: ['passive', 'version', ...(rule.cve ? ['cve'] : [])],
    })
  }

  return {
    fingerprint: {
      status: page.status, title, server: headers.server ? clip(headers.server, 200) : null,
      technologies, finalUrl: page.finalUrl, redirects: Math.max(0, (page.redirectChain?.length || 0)),
    },
    findings,
  }
}

function headerFindings(headers: Record<string, string>, isHttps: boolean, url: string): FindingInput[] {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
  const out: FindingInput[] = []
  const missing = (header: string, label: string, severity: SecurityScanSeverity, rule: string, recommendation: string, refs: string[]) => {
    if (lower[header]) return
    if (!isHttps && header === 'strict-transport-security') return
    out.push({
      rule, category: 'headers', severity, title: `缺少 ${label}`,
      detail: `回應沒有 ${label} 標頭。`, recommendation,
      location: { url }, evidence: { header }, cwe: ['CWE-693'], refs, tags: ['passive', 'header'],
    })
  }
  missing('content-security-policy', 'Content-Security-Policy', 'medium', 'headers.csp.missing',
    '加入以 default-src \'self\' 為基礎的 CSP，並逐步移除 unsafe-inline。', ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'])
  missing('x-content-type-options', 'X-Content-Type-Options', 'low', 'headers.nosniff.missing',
    '設定 X-Content-Type-Options: nosniff，避免瀏覽器猜錯內容類型。', ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options'])
  missing('x-frame-options', 'X-Frame-Options', 'medium', 'headers.frame.missing',
    '設定 X-Frame-Options: DENY 或 CSP frame-ancestors，避免 clickjacking。', ['https://owasp.org/www-community/attacks/Clickjacking'])
  missing('referrer-policy', 'Referrer-Policy', 'low', 'headers.referrer.missing',
    '設定 Referrer-Policy: strict-origin-when-cross-origin，減少 URL 資訊外洩。', ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy'])
  missing('permissions-policy', 'Permissions-Policy', 'info', 'headers.permissions.missing',
    '用 Permissions-Policy 關閉用不到的瀏覽器功能（camera、geolocation 等）。', ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy'])

  const hsts = lower['strict-transport-security']
  if (isHttps && hsts) {
    const maxAge = Number(/max-age\s*=\s*(\d+)/i.exec(hsts)?.[1] ?? 0)
    if (maxAge < 15552000) out.push({
      rule: 'headers.hsts.short', category: 'headers', severity: 'low',
      title: 'HSTS max-age 過短', detail: `目前 max-age=${maxAge} 秒，建議至少 180 天。`,
      recommendation: '將 max-age 提升至 15552000（180 天）以上，並確認 subdomains 設定符合需求。',
      location: { url }, evidence: { maxAge }, cwe: ['CWE-319'], refs: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security'], tags: ['passive', 'header'],
    })
  }
  const csp = lower['content-security-policy']
  if (csp && /script-src[^;]*'unsafe-inline'|script-src[^;]*\*/i.test(csp)) out.push({
    rule: 'headers.csp.unsafe_inline', category: 'headers', severity: 'low',
    title: 'CSP script-src 允許 unsafe-inline', detail: 'script-src 包含 unsafe-inline 或 *，對 XSS 的防護效果有限。',
    recommendation: '改用 nonce／hash 或外部腳本，移除 unsafe-inline。',
    location: { url }, evidence: { csp: clip(csp, 240) }, cwe: ['CWE-79'], refs: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'], tags: ['passive', 'header'],
  })
  return out
}

function cookieFindings(setCookie: string | undefined, isHttps: boolean, url: string): FindingInput[] {
  if (!setCookie) return []
  const out: FindingInput[] = []
  const cookies = setCookie.split(/\n|,(?=\s*[^;,=]+\s*=)/).slice(0, 10)
  for (const raw of cookies) {
    const name = raw.split('=', 1)[0]?.trim() || ''
    if (!/^(session|sessionid|sid|auth|token|jwt|access|connect\.sid|\.aspnetcore)/i.test(name)) continue
    const lower = raw.toLowerCase()
    const missing: string[] = []
    if (isHttps && !/;\s*secure\b/.test(lower)) missing.push('Secure')
    if (!/;\s*httponly\b/.test(lower)) missing.push('HttpOnly')
    if (!/;\s*samesite\b/.test(lower)) missing.push('SameSite')
    const sameSiteNoneWithoutSecure = /;\s*samesite\s*=\s*none\b/.test(lower) && !/;\s*secure\b/.test(lower)
    if (!missing.length && !sameSiteNoneWithoutSecure) continue
    if (sameSiteNoneWithoutSecure) out.push({
      rule: 'cookies.samesite_none_without_secure', category: 'cookies', severity: 'high',
      title: `工作階段 cookie ${name} 使用 SameSite=None 但沒有 Secure`,
      detail: 'SameSite=None 且缺少 Secure 時，瀏覽器可能拒絕該 cookie，或讓它在跨站情境下被送出。',
      recommendation: '加上 Secure；若不需要跨站傳送，改用 SameSite=Lax。',
      location: { url, param: name }, evidence: { cookie: name, sameSite: 'None' },
      cwe: ['CWE-614'], refs: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value'], tags: ['passive', 'cookie'],
    })
    if (!missing.length) continue
    out.push({
      rule: 'cookies.attributes', category: 'cookies', severity: missing.includes('Secure') && isHttps ? 'high' : 'medium',
      title: `工作階段 cookie ${name} 缺少安全屬性`,
      detail: `缺少 ${missing.join('、')}。`,
      recommendation: '為工作階段 cookie 加上 Secure、HttpOnly 與 SameSite=Lax（或更嚴格的設定）。',
      location: { url, param: name }, evidence: { cookie: name, missing: missing.join(',') },
      cwe: ['CWE-614', 'CWE-1004'], refs: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies'], tags: ['passive', 'cookie'],
    })
  }
  return out
}

function tlsFindings(page: AuditFetchResult, target: URL, url: string): FindingInput[] {
  const tls = page.tlsInfo
  if (target.protocol !== 'https:' || !tls) return []
  const out: FindingInput[] = []
  const host = normalizedHost(target)
  const expired = !tls.valid || tls.daysRemaining < 0
  const severity: SecurityScanSeverity = expired ? 'critical' : tls.daysRemaining < 14 ? 'high' : tls.daysRemaining < 30 ? 'medium' : 'info'
  if (expired || severity !== 'info') out.push({
    rule: expired ? 'tls.cert.expired' : 'tls.cert.expiring', category: 'tls', severity,
    title: expired ? 'TLS 憑證無效或已過期' : 'TLS 憑證即將過期',
    detail: `${tls.issuer || 'unknown issuer'} · 剩餘 ${tls.daysRemaining} 天。`,
    recommendation: '更新憑證並確認自動續約機制正常運作。',
    location: { url, host }, evidence: { issuer: tls.issuer, daysRemaining: tls.daysRemaining, valid: tls.valid },
    cwe: ['CWE-295'], refs: ['https://developer.mozilla.org/en-US/docs/Web/Security/Certificates'], tags: ['passive', 'tls'],
  })
  if (!hostMatches(tls.subjectAltName || [], host)) out.push({
    rule: 'tls.cert.hostname', category: 'tls', severity: 'high',
    title: 'TLS 憑證 hostname 不符', detail: `憑證 SAN 不含 ${host}。`,
    recommendation: '重新簽發包含該 host 的憑證。',
    location: { url, host }, evidence: { host, san: (tls.subjectAltName || []).slice(0, 10).join(',') },
    cwe: ['CWE-297'], refs: ['https://developer.mozilla.org/en-US/docs/Web/Security/Certificates'], tags: ['passive', 'tls'],
  })
  return out
}

function redirectFindings(page: AuditFetchResult, target: URL, url: string): FindingInput[] {
  const out: FindingInput[] = []
  const final = (() => { try { return new URL(page.finalUrl) } catch { return target } })()
  if (target.protocol === 'https:' && final.protocol !== 'https:') out.push({
    rule: 'redirect.downgrade', category: 'redirect', severity: 'high',
    title: 'HTTPS 重新導向至 HTTP', detail: `${target.href} → ${page.finalUrl}`,
    recommendation: '修正重新導向規則並啟用 HSTS，避免降級攻擊。',
    location: { url }, evidence: { finalUrl: page.finalUrl }, cwe: ['CWE-319'],
    refs: ['https://owasp.org/www-community/attacks/HTTP_Downgrade'], tags: ['passive', 'redirect'],
  })
  const chain = page.redirectChain || []
  if (chain.length > 2) out.push({
    rule: 'redirect.chain', category: 'redirect', severity: 'info',
    title: '重新導向鏈過長', detail: `${chain.length} 跳 → ${page.finalUrl}`,
    recommendation: '縮短重新導向鏈，降低延遲與維護成本。',
    location: { url }, evidence: { hops: chain.length }, cwe: [],
    refs: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections'], tags: ['passive', 'redirect'],
  })
  return out
}

async function dnsFindings(target: URL, lookupFn: typeof lookup, resolveTxtFn: typeof resolveTxt, url: string): Promise<FindingInput[]> {
  const host = normalizedHost(target)
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookupFn(host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address, false))) return []
  const txt = async (name: string): Promise<string[]> => {
    try {
      const records = await resolveTxtFn(name)
      return records.map(parts => parts.join(''))
    } catch { return [] }
  }
  const out: FindingInput[] = []
  const spf = (await txt(host)).find(value => /^v=spf1\b/i.test(value))
  if (!spf) out.push({
    rule: 'dns.spf.missing', category: 'dns', severity: 'low',
    title: '未發現 SPF 記錄', detail: `${host} 沒有 v=spf1 TXT 記錄。`,
    recommendation: '若此網域會寄信，請發布 SPF 記錄；不寄信則可忽略。',
    location: { url, host }, evidence: { host }, cwe: [],
    refs: ['https://datatracker.ietf.org/doc/html/rfc7208'], tags: ['passive', 'dns'],
  })
  const dmarc = (await txt(`_dmarc.${host}`)).find(value => /^v=dmarc1\b/i.test(value))
  if (!dmarc) out.push({
    rule: 'dns.dmarc.missing', category: 'dns', severity: 'medium',
    title: '未發現 DMARC 記錄', detail: `_dmarc.${host} 沒有 v=DMARC1 TXT 記錄。`,
    recommendation: '若此網域會寄信，請先發布 SPF／DKIM 再逐步启用 DMARC（p=none 起步）。',
    location: { url, host }, evidence: { host }, cwe: [],
    refs: ['https://datatracker.ietf.org/doc/html/rfc7489'], tags: ['passive', 'dns'],
  })
  return out
}

/** active_light：只對少數眾所周知的路徑送出 HEAD，不看內容、不注入、不跟大量重新導向。 */
const EXPOSURE_PATHS = [
  { path: '/.env', label: '環境變數檔', cwe: 'CWE-538' },
  { path: '/.git/config', label: 'Git 設定檔', cwe: 'CWE-538' },
  { path: '/.DS_Store', label: 'macOS 目錄索引', cwe: 'CWE-548' },
  { path: '/server-status', label: 'Apache server-status', cwe: 'CWE-200' },
  { path: '/actuator/env', label: 'Spring Boot actuator/env', cwe: 'CWE-200' },
  { path: '/phpinfo.php', label: 'phpinfo', cwe: 'CWE-200' },
] as const

async function exposureFindings(
  target: URL, fetcher: AuditFetcher, url: string, maxProbes: number,
): Promise<{ findings: FindingInput[]; probesUsed: number; warnings: string[] }> {
  const enabled = EXPOSURE_PATHS.slice(0, Math.max(0, Math.min(MAX_PROBES, maxProbes)))
  const findings: FindingInput[] = []
  const warnings: string[] = []
  let probesUsed = 0
  for (const probe of enabled) {
    probesUsed++
    try {
      let probeUrl: URL
      try { probeUrl = new URL(probe.path, target) } catch { continue }
      const response = await fetcher(probeUrl.href, 'HEAD')
      const contentType = String(response.headers['content-type'] || '').toLowerCase()
      const exposed = response.status >= 200 && response.status < 300 && !/text\/html/.test(contentType)
      if (!exposed) continue
      findings.push({
        rule: `exposure.${probe.path.replace(/[^a-z0-9]+/gi, '_')}`, category: 'exposure', severity: 'high',
        title: `可能暴露${probe.label}`, detail: `${probeUrl.href} 回 HTTP ${response.status}（${contentType || 'unknown content-type'}）。`,
        recommendation: `在網頁伺服器阻擋 ${probe.path} 的公開存取，並檢查是否曾經外洩敏感內容。`,
        location: { url: probeUrl.href }, evidence: { status: response.status, contentType },
        cwe: [probe.cwe], refs: ['https://owasp.org/www-project-web-security-testing-guide/'], tags: ['active_light', 'exposure'],
      })
    } catch (error) {
      warnings.push(`PROBE_FAILED ${probe.path}: ${error instanceof HttpCheckError ? error.code : 'ERROR'}`)
    }
  }
  return { findings, probesUsed, warnings }
}

/** 對外公開是為了回歸測試：調度端沒注入 fetcher 時必須用真正的 site-audit fetcher。 */
export function resolveAuditFetcher(deps: SecurityScanDeps): AuditFetcher {
  return deps.fetcher || defaultAuditFetcher
}

export function scoreFindings(findings: SecurityFinding[]): { score: number; grade: SecurityScanReport['grade']; riskLevel: SecurityScanReport['riskLevel'] } {
  const penalty = findings.reduce((sum, finding) => sum + (PENALTY[finding.severity] || 0), 0)
  const score = Math.max(0, Math.min(100, 100 - penalty))
  const grade: SecurityScanReport['grade'] = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
  let riskLevel: SecurityScanReport['riskLevel'] = 'none'
  for (const severity of SECURITY_SCAN_SEVERITIES) if (findings.some(f => f.severity === severity)) riskLevel = severity
  return { score, grade, riskLevel }
}

export async function runSecurityScan(input: SecurityScanInput, deps: SecurityScanDeps = {}): Promise<SecurityScanReport> {
  const fetcher = resolveAuditFetcher(deps)
  const lookupFn = deps.lookupFn || lookup
  const resolveTxtFn = deps.resolveTxtFn || resolveTxt
  const started = Date.now()
  const enabled = (category: SecurityScanCategory): boolean => input.categories?.[category] !== false
  const warnings: string[] = []

  let target: URL
  try { target = new URL(input.url) } catch { throw new HttpCheckError('CONFIG_ERROR') }

  const requested: SecurityScanProfile = input.profile === 'active_light' ? 'active_light' : 'passive'
  let verified = false
  if (requested === 'active_light') {
    verified = deps.verifyOwnership ? await deps.verifyOwnership(input) : false
    if (!verified) warnings.push('OWNERSHIP_UNVERIFIED: active_light 已降級為 passive')
  }
  const profile: SecurityScanProfile = requested === 'active_light' && verified ? 'active_light' : 'passive'
  await assertPublicDestination(target, lookupFn)

  let page: AuditFetchResult
  try {
    page = await fetcher(target.href, 'GET')
  } catch (error) {
    // 連不上也算一份報告，讓使用者看到「沒有指紋」而不是拿到 500。
    page = {
      status: 0, headers: {}, body: '', elapsed: Date.now() - started,
      finalUrl: target.href, tlsInfo: null, redirectChain: [],
    }
    warnings.push(`FETCH_FAILED: ${error instanceof HttpCheckError ? error.code : 'ERROR'}`)
  }

  const findings: FindingInput[] = []
  const fp = fingerprintFrom(page, target.href)
  if (enabled('fingerprint')) findings.push(...fp.findings)
  if (enabled('headers')) findings.push(...headerFindings(page.headers, page.finalUrl.startsWith('https:'), target.href))
  if (enabled('cookies')) findings.push(...cookieFindings(page.headers['set-cookie'], page.finalUrl.startsWith('https:'), target.href))
  if (enabled('tls')) findings.push(...tlsFindings(page, target, target.href))
  if (enabled('tls') && target.protocol === 'https:') {
    try {
      const port = target.port ? Number(target.port) : 443
      const probe = await (deps.tlsProber || defaultTlsProber)(normalizedHost(target), port, normalizedHost(target))
      if (probe.legacy) findings.push({
        rule: 'tls.protocol.legacy', category: 'tls', severity: 'high',
        title: '伺服器仍接受舊版 TLS（1.0／1.1）',
        detail: '以 TLS 1.0／1.1 握手成功；這些協定已被淘汰，可能受到降級攻擊。',
        recommendation: '在反向代理／伺服器設定最低 TLS 1.2（建議 1.3），關閉 TLS 1.0／1.1。',
        location: { url: target.href, host: normalizedHost(target) },
        evidence: { legacyAccepted: true }, cwe: ['CWE-327'],
        refs: ['https://datatracker.ietf.org/doc/html/rfc8996'], tags: ['passive', 'tls'],
      })
    } catch (error) {
      warnings.push(`TLS_PROBE_FAILED: ${error instanceof Error ? error.message.slice(0, 100) : 'ERROR'}`)
    }
  }
  if (enabled('redirect')) findings.push(...redirectFindings(page, target, target.href))

  if (enabled('dns')) {
    try { findings.push(...await dnsFindings(target, lookupFn, resolveTxtFn, target.href)) }
    catch (error) { warnings.push(`DNS_FAILED: ${error instanceof Error ? error.message.slice(0, 100) : 'ERROR'}`) }
  }

  let probesUsed = 0
  if (profile === 'active_light' && enabled('exposure')) {
    const probes = await exposureFindings(target, fetcher, target.href, input.maxProbes ?? 3)
    findings.push(...probes.findings)
    probesUsed = probes.probesUsed
    warnings.push(...probes.warnings)
  } else if (enabled('exposure') && profile === 'passive') {
    warnings.push('EXPOSURE_SKIPPED: 被動模式不送出探測請求（需驗證擁有權）')
  }

  // 去重＋排序；同一規則同一位置只留最严重的一筆。
  const byKey = new Map<string, SecurityFinding>()
  for (const finding of findings) {
    const key = `${finding.rule}|${finding.location.url || finding.location.host || ''}|${finding.location.param || ''}`
    const existing = byKey.get(key)
    if (existing && SEVERITY_RANK[existing.severity] >= SEVERITY_RANK[finding.severity]) continue
    byKey.set(key, { ...finding, key })
  }
  const sorted = [...byKey.values()]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.key.localeCompare(b.key))
    .slice(0, MAX_FINDINGS)
  const { score, grade, riskLevel } = scoreFindings(sorted)

  return {
    url: input.url, finalUrl: page.finalUrl, host: normalizedHost(target), profile,
    checkedAt: (deps.now || new Date()).toISOString(), durationMs: Date.now() - started,
    score, grade, riskLevel, findings: sorted, fingerprint: fp.fingerprint, warnings,
    limits: { maxProbes: MAX_PROBES, probesUsed, maxFindings: MAX_FINDINGS },
  }
}

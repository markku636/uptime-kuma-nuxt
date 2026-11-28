import { z } from 'zod'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { TLSInfo } from '../monitor/checkers/tls-checker'
import { executeHttpRequest, isForbiddenAddress, HttpCheckError } from '../monitor/checkers/http-request'

export type AuditStatus = 'pass' | 'warn' | 'fail' | 'skip'
export interface AuditCheck {
  id: string
  label: string
  status: AuditStatus
  summary: string
  detail?: string[]
}
export interface AuditReport {
  url: string
  finalUrl: string
  checkedAt: string
  durationMs: number
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  checks: AuditCheck[]
  redirectChain?: string[]
}
export type AuditCheckId = 'tls' | 'dns' | 'headers' | 'meta' | 'links' | 'keyword'
export const auditChecksSchema = z.object({
  tls: z.boolean().optional(), dns: z.boolean().optional(), headers: z.boolean().optional(),
  meta: z.boolean().optional(), links: z.boolean().optional(), keyword: z.boolean().optional(),
}).strict()
export interface AuditInput {
  url: string
  keyword?: string
  /** 可關閉個別檢查；HTTP 必做，其餘預設開啟。 */
  checks?: Partial<Record<AuditCheckId, boolean>>
  linkLimit?: number
}
export interface AuditFetchResult {
  status: number
  headers: Record<string, string>
  body: string
  elapsed: number
  finalUrl: string
  tlsInfo?: TLSInfo | null
  redirectChain?: string[]
}
export type AuditFetcher = (url: string, method: 'GET' | 'HEAD') => Promise<AuditFetchResult>
export interface AuditDeps { fetcher?: AuditFetcher; lookupFn?: typeof lookup }

const SECURITY_HEADERS = [
  ['strict-transport-security', 'HSTS'],
  ['content-security-policy', 'CSP'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['x-frame-options', 'X-Frame-Options'],
  ['referrer-policy', 'Referrer-Policy'],
  ['permissions-policy', 'Permissions-Policy'],
] as const
const METADATA_HOSTS = new Set(['metadata.google.internal', 'metadata.google', 'instance-data.ec2.internal', 'metadata.azure.internal'])
const MAX_LINKS = 8
const UA = 'SealWatch-SiteAudit/1.0'

function normalizedHost(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
}

/** Audit traffic must never reach private/metadata addresses, even when the
 *  general HTTP checker is configured with HTTP_ALLOW_PRIVATE=true. */
async function assertPublicDestination(url: URL, lookupFn: typeof lookup): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 8192) throw new HttpCheckError('CONFIG_ERROR')
  const host = normalizedHost(url)
  if (!host || METADATA_HOSTS.has(host) || url.username || url.password) throw new HttpCheckError('DESTINATION_DENIED')
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookupFn(host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address, false))) throw new HttpCheckError('DESTINATION_DENIED')
}

export const defaultAuditFetcher: AuditFetcher = async (urlString, method) => {
  let url: URL
  try { url = new URL(urlString) } catch { throw new HttpCheckError('CONFIG_ERROR') }
  const started = Date.now()
  const redirectChain: string[] = []
  for (let hop = 0; hop <= 2; hop++) {
    await assertPublicDestination(url, lookup)
    // maxRedirects:0 makes follow() return the raw 3xx response; its internal
    // `location` field is intentionally not part of the public result type.
    const response = await executeHttpRequest({
      url: url.href,
      method,
      timeout: 10,
      maxRedirects: 0,
      // 與 assertPublicDestination 同一輪都強制 deny 私網，避免 DNS rebinding 在第二次解析時穿過去。
      strictPrivate: true,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' },
    }, started) as Awaited<ReturnType<typeof executeHttpRequest>> & { location?: string }
    if ([301, 302, 303, 307, 308].includes(response.status) && response.location && hop < 2) {
      let next: URL
      try { next = new URL(response.location, url) } catch { throw new HttpCheckError('INVALID_RESPONSE') }
      if (url.protocol === 'https:' && next.protocol !== 'https:') throw new HttpCheckError('DESTINATION_DENIED')
      redirectChain.push(url.href)
      url = next
      continue
    }
    return { ...response, finalUrl: url.href, redirectChain }
  }
  throw new HttpCheckError('REDIRECT_LIMIT')
}

export function checkSecurityHeaders(headers: Record<string, string>, isHttps: boolean): AuditCheck {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
  const missing: string[] = []
  for (const [header, label] of SECURITY_HEADERS) {
    if (!isHttps && header === 'strict-transport-security') continue
    if (!lower[header]) missing.push(label)
  }
  if (!missing.length) return { id: 'headers', label: 'Security headers', status: 'pass', summary: `All ${SECURITY_HEADERS.length - (isHttps ? 0 : 1)} checks present` }
  return {
    id: 'headers', label: 'Security headers', status: missing.length >= 3 ? 'fail' : 'warn',
    summary: `Missing ${missing.length}: ${missing.join(', ')}`,
    detail: missing.map(label => `缺少 ${label}`),
  }
}

export interface PageMeta {
  title: string | null
  description: string | null
  viewport: boolean
  lang: string | null
  noIndex: boolean
}
export function parsePageMeta(html: string): PageMeta {
  const head = html.slice(0, 262144)
  const title = /<title[^>]*>([\s\S]{1,300}?)<\/title>/i.exec(head)?.[1]?.replace(/<[^>]+>/g, '').trim() || null
  const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,500})["']/i.exec(head)?.[1]?.trim() || null
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(head)
  const lang = /<html[^>]+lang=["']([^"']{1,40})["']/i.exec(head)?.[1]?.trim() || null
  const noIndex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(head)
  return { title, description, viewport, lang, noIndex }
}

export function extractLinks(html: string, baseUrl: string, limit = MAX_LINKS): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  const origin = new URL(baseUrl).origin
  const pattern = /<(?:a|link|script|img|iframe)\b[^>]*?(?:href|src)\s*=\s*(["'])([^"']{1,2048})\1/gi
  for (const match of html.slice(0, 524288).matchAll(pattern)) {
    try {
      const resolved = new URL(match[2]!, baseUrl)
      if (resolved.origin !== origin || !['http:', 'https:'].includes(resolved.protocol)) continue
      resolved.hash = ''
      const key = resolved.href
      if (seen.has(key)) continue
      seen.add(key)
      result.push(key)
      if (result.length >= limit) break
    } catch { /* ignore malformed attribute values */ }
  }
  return result
}

export function scoreChecks(checks: AuditCheck[]): { score: number; grade: AuditReport['grade'] } {
  let score = 100
  const byId = new Map(checks.map(check => [check.id, check]))
  const apply = (id: string, fail: number, warn = Math.ceil(fail / 3)) => {
    const status = byId.get(id)?.status
    if (status === 'fail') score -= fail
    else if (status === 'warn') score -= warn
  }
  apply('http', 35)
  apply('tls', 20)
  apply('dns', 20)
  apply('keyword', 12)
  const headers = byId.get('headers')
  if (headers?.status === 'fail') score -= 12
  else if (headers?.status === 'warn') score -= Math.min(12, 2 * Math.max(1, headers.detail?.length || 1))
  const meta = byId.get('meta')
  if (meta?.status === 'warn') score -= Math.min(8, 4 * Math.max(1, meta.detail?.length || 1))
  const links = byId.get('links')
  if (links?.status === 'fail') score -= Math.min(20, 10 * Math.max(1, links.detail?.length || 1))
  else if (links?.status === 'warn') score -= 8
  score = Math.max(0, Math.min(100, score))
  const grade: AuditReport['grade'] = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
  return { score, grade }
}

function errorSummary(error: unknown): string {
  return error instanceof HttpCheckError ? error.code : error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN_ERROR'
}

export async function runSiteAudit(input: AuditInput, deps: AuditDeps = {}): Promise<AuditReport> {
  const fetcher = deps.fetcher || defaultAuditFetcher
  const lookupFn = deps.lookupFn || lookup
  const started = Date.now()
  const checks: AuditCheck[] = []
  const enabled = (id: AuditCheckId): boolean => input.checks?.[id] !== false
  const skipped = (id: AuditCheckId, label: string): AuditCheck => ({ id, label, status: 'skip', summary: 'Disabled in this audit' })
  let page: AuditFetchResult | null = null
  try {
    page = await fetcher(input.url, 'GET')
    const status = page.status
    checks.push({
      id: 'http', label: 'HTTP response',
      status: status >= 200 && status < 300 ? 'pass' : status < 400 || status === 401 || status === 403 ? 'warn' : 'fail',
      summary: `HTTP ${status} · ${page.elapsed} ms`,
      detail: page.redirectChain?.length ? page.redirectChain.map((from, index) => `${index + 1}. ${from}`) : page.finalUrl !== input.url ? [`重新導向至 ${page.finalUrl}`] : undefined,
    })
  } catch (error) {
    checks.push({ id: 'http', label: 'HTTP response', status: 'fail', summary: `連線失敗：${errorSummary(error)}` })
  }

  let target: URL
  try { target = new URL(page?.finalUrl || input.url) } catch { target = new URL(input.url) }
  const isHttps = target.protocol === 'https:'

  if (!enabled('tls')) checks.push(skipped('tls', 'TLS certificate'))
  else if (isHttps && page?.tlsInfo) {
    const tls = page.tlsInfo
    const names = tls.subjectAltName || []
    const host = normalizedHost(target)
    const hostnameMatch = !names.length || names.some(name => name === host || name.startsWith('*.') && host.endsWith(name.slice(1)))
    const status: AuditStatus = !tls.valid || tls.daysRemaining < 0 ? 'fail' : tls.daysRemaining < 14 || !hostnameMatch ? 'warn' : 'pass'
    checks.push({
      id: 'tls', label: 'TLS certificate', status,
      summary: `${tls.issuer || 'unknown issuer'} · ${tls.daysRemaining} days remaining`,
      detail: [
        `到期：${tls.validTo instanceof Date ? tls.validTo.toISOString().slice(0, 10) : String(tls.validTo)}`,
        ...(hostnameMatch ? [] : [`憑證 SAN 不含 ${host}`]),
        ...(tls.valid ? [] : ['憑證未被信任或 hostname 不符']),
      ],
    })
  } else if (isHttps) {
    checks.push({ id: 'tls', label: 'TLS certificate', status: 'warn', summary: '未能取得憑證資訊' })
  } else {
    checks.push({ id: 'tls', label: 'TLS certificate', status: 'skip', summary: '目標非 HTTPS，不適用' })
  }

  if (!enabled('dns')) checks.push(skipped('dns', 'DNS resolution'))
  else try {
    const addresses = isIP(normalizedHost(target)) ? [{ address: normalizedHost(target), family: isIP(normalizedHost(target)) }] : await lookupFn(normalizedHost(target), { all: true })
    const blocked = addresses.filter(({ address }) => isForbiddenAddress(address, false))
    checks.push({
      id: 'dns', label: 'DNS resolution', status: blocked.length ? 'fail' : 'pass',
      summary: `${addresses.length} address(es)`,
      detail: addresses.slice(0, 8).map(({ address, family }) => `IPv${family} ${address}${blocked.some(b => b.address === address) ? ' (blocked)' : ''}`),
    })
  } catch (error) {
    checks.push({ id: 'dns', label: 'DNS resolution', status: 'fail', summary: `解析失敗：${errorSummary(error)}` })
  }

  checks.push(enabled('headers')
    ? page ? checkSecurityHeaders(page.headers, isHttps) : { id: 'headers', label: 'Security headers', status: 'fail', summary: '無法讀取回應標頭' }
    : skipped('headers', 'Security headers'))

  const contentType = String(page?.headers['content-type'] || '').toLowerCase()
  if (!enabled('meta')) checks.push(skipped('meta', 'Page metadata'))
  else if (page && /html/.test(contentType)) {
    const meta = parsePageMeta(page.body)
    const missing = [
      ...(meta.title ? [] : ['title']),
      ...(meta.description ? [] : ['description']),
      ...(meta.viewport ? [] : ['viewport']),
      ...(meta.lang ? [] : ['lang']),
      ...(meta.noIndex ? ['robots noindex' ] : []),
    ]
    checks.push({
      id: 'meta', label: 'Page metadata', status: missing.length ? 'warn' : 'pass',
      summary: missing.length ? `Missing/issue: ${missing.join(', ')}` : 'title / description / viewport / lang present',
      detail: missing.map(item => `缺少或異常：${item}`),
    })
  } else {
    checks.push({ id: 'meta', label: 'Page metadata', status: 'skip', summary: '非 HTML 內容，不適用' })
  }

  const links = enabled('links') && page ? extractLinks(page.body, page.finalUrl, Math.max(1, Math.min(20, input.linkLimit ?? MAX_LINKS))) : []
  if (!enabled('links')) checks.push(skipped('links', 'Local links'))
  else if (!links.length) {
    checks.push({ id: 'links', label: 'Local links', status: 'skip', summary: '沒有可檢查的同站連結' })
  } else {
    const broken: string[] = []
    const mixed: string[] = []
    await Promise.all(links.map(async link => {
      if (isHttps && link.startsWith('http:')) mixed.push(link)
      try {
        const result = await fetcher(link, 'HEAD')
        if (result.status >= 400 && result.status !== 405) broken.push(`${result.status} ${link}`)
      } catch { broken.push(`ERROR ${link}`) }
    }))
    checks.push({
      id: 'links', label: 'Local links',
      status: broken.length ? 'fail' : mixed.length ? 'warn' : 'pass',
      summary: `${links.length} checked · ${broken.length} broken · ${mixed.length} mixed-content`,
      detail: [...broken, ...mixed].slice(0, 6),
    })
  }

  if (!enabled('keyword')) checks.push(skipped('keyword', 'Keyword'))
  else if (input.keyword) {
    const found = !!page && page.body.toLowerCase().includes(input.keyword.toLowerCase())
    checks.push({ id: 'keyword', label: 'Keyword', status: found ? 'pass' : 'fail', summary: found ? `Found "${input.keyword}"` : `Not found "${input.keyword}"` })
  } else {
    checks.push({ id: 'keyword', label: 'Keyword', status: 'skip', summary: '未指定關鍵字' })
  }

  const { score, grade } = scoreChecks(checks)
  return {
    url: input.url, finalUrl: page?.finalUrl || input.url, checkedAt: new Date().toISOString(),
    durationMs: Date.now() - started, score, grade, checks,
    redirectChain: page?.redirectChain || [],
  }
}

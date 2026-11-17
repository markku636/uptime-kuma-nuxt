// server/services/monitor/checkers/http-options.ts
// Pure helpers for HTTP monitor requests (no Nitro / Prisma imports), so
// they can be unit tested: tests/server/http-options.test.ts.

/** Stored headers are a JSON object, or (older rows / imports) a JSON string */
export function parseHeaders(value: unknown): Record<string, string> {
  let headers = value
  if (typeof headers === 'string') {
    if (!headers.trim()) return {}
    try { headers = JSON.parse(headers) } catch { return {} }
  }
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (k && v != null) out[k] = String(v)
  }
  return out
}

/** `DOMAIN\user` → domain + user (NTLM); a plain name has no domain */
export function splitNtlmUser(user: string): { domain: string; username: string } {
  const i = user.indexOf('\\')
  return i > 0 ? { domain: user.slice(0, i), username: user.slice(i + 1) } : { domain: '', username: user }
}

export interface ProxyRow {
  protocol: string
  host: string
  port: number
  auth: boolean
  username: string | null
  password: string | null
}

/** Proxy URL for an HTTP(S) proxy; null for protocols this checker cannot use */
export function proxyUrl(proxy: ProxyRow): string | null {
  const protocol = proxy.protocol.toLowerCase()
  if (protocol !== 'http' && protocol !== 'https') return null
  const auth = proxy.auth && proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? '')}@`
    : ''
  return `${protocol}://${auth}${proxy.host}:${proxy.port}`
}

/** The body as text, for keyword checks */
export function bodyText(data: unknown): string {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  return JSON.stringify(data) ?? ''
}

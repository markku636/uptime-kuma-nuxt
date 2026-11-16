// Pure helpers for API key authentication (no Nuxt/Prisma imports so they can be unit tested).

export const API_KEY_PREFIX = 'uk_'

/** Paths an API key may authenticate. Session-only routes (/api/auth/*, UI settings) stay cookie-only. */
export const API_KEY_SCOPE = '/api/v1/'

/**
 * Paths an API key must not reach even inside the scope: a leaked key must not be able
 * to mint new keys or revoke existing ones.
 */
const API_KEY_FORBIDDEN = ['/api/v1/api-keys']

type HeaderValue = string | string[] | undefined

function first(value: HeaderValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Read an API key from `X-API-Key: uk_...` or `Authorization: Bearer uk_...`.
 * Returns undefined when the request carries no API key (other bearer tokens are ignored).
 */
export function extractApiKey(headers: { xApiKey?: HeaderValue, authorization?: HeaderValue }): string | undefined {
  const direct = first(headers.xApiKey)?.trim()
  if (direct) return direct

  const auth = first(headers.authorization)?.trim()
  const match = auth?.match(/^Bearer\s+(\S+)$/i)
  if (match && match[1].startsWith(API_KEY_PREFIX)) return match[1]
  return undefined
}

export function isApiKeyPath(path: string): boolean {
  const pathname = path.split('?')[0]
  return pathname.startsWith(API_KEY_SCOPE)
}

export function isForbiddenForApiKey(path: string): boolean {
  const pathname = path.split('?')[0]
  return API_KEY_FORBIDDEN.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export interface StoredApiKey {
  active: boolean
  expires: Date | null
  user: { active: boolean } | null
}

export type ApiKeyCheck = { ok: true } | { ok: false, reason: string }

export function checkApiKey(key: StoredApiKey | null, now = new Date()): ApiKeyCheck {
  if (!key) return { ok: false, reason: 'Invalid API key' }
  if (!key.active) return { ok: false, reason: 'API key is disabled' }
  if (key.expires && key.expires.getTime() <= now.getTime()) return { ok: false, reason: 'API key has expired' }
  if (!key.user || !key.user.active) return { ok: false, reason: 'API key owner is disabled' }
  return { ok: true }
}

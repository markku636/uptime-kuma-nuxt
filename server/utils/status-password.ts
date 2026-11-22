import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie } from 'h3'

const TTL_MS = 30 * 24 * 3_600_000

function cookieName(pageId: number) {
  return `status_unlock_${pageId}`
}

function signature(event: H3Event, payload: string) {
  return createHmac('sha256', useRuntimeConfig(event).session.password).update(payload).digest('base64url')
}

export function issueStatusUnlock(event: H3Event, pageId: number, hash: string) {
  const payload = Buffer.from(JSON.stringify({
    pageId,
    hash: hash.slice(0, 24),
    expiresAt: Date.now() + TTL_MS,
  })).toString('base64url')
  const token = `${payload}.${signature(event, payload)}`
  setCookie(event, cookieName(pageId), token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  })
  return token
}

export function clearStatusUnlock(event: H3Event, pageId: number) {
  deleteCookie(event, cookieName(pageId), { path: '/' })
}

export function hasStatusUnlock(event: H3Event, pageId: number, hash: string) {
  const token = getCookie(event, cookieName(pageId))
  if (!token || typeof token !== 'string') return false
  const [payload, sig, extra] = token.split('.')
  if (!payload || !sig || extra) return false
  const expected = Buffer.from(signature(event, payload))
  const actual = Buffer.from(sig)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { pageId: number; hash: string; expiresAt: number }
    return parsed.pageId === pageId && parsed.hash === hash.slice(0, 24) && Number.isFinite(parsed.expiresAt) && parsed.expiresAt > Date.now()
  } catch {
    return false
  }
}

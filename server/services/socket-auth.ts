// server/services/socket-auth.ts
// Who is on the other end of a Socket.IO connection: the user of the login
// session cookie sent with the handshake (the same sealed cookie the REST API
// reads through nuxt-auth-utils). No cookie, a bad seal, an expired session or
// an inactive user means nobody.
import { unsealSession } from 'h3'
import { prisma } from '../utils/prisma'
import { isSessionRevoked } from './auth/session-revocation'

/** Value of one cookie in a Cookie header */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() !== name) continue
    const value = part.slice(i + 1).trim()
    try { return decodeURIComponent(value) } catch { return value }
  }
  return null
}

/**
 * A browser handshake must come from this site. Non-browser clients send no
 * Origin and are let through (they still need a valid session cookie).
 * Behind a proxy the forwarded host is what the browser saw.
 */
export function isSameOrigin(headers: Record<string, string | string[] | undefined>, publicUrls: (string | null | undefined)[] = []): boolean {
  const origin = headers.origin
  if (!origin || typeof origin !== 'string') return true
  let originHost: string
  try { originHost = new URL(origin).host.toLowerCase() } catch { return false }
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim().toLowerCase()
  const hosts = [first(headers['x-forwarded-host']), first(headers.host)].filter(Boolean)
  if (hosts.includes(originHost)) return true
  // The public address when the proxy rewrites Host: NUXT_PUBLIC_APP_URL,
  // or Settings > General > Primary Base URL
  for (const url of [process.env.NUXT_PUBLIC_APP_URL, ...publicUrls]) {
    try {
      if (url && new URL(url).host.toLowerCase() === originHost) return true
    } catch { /* not a URL */ }
  }
  return false
}

function sessionConfig() {
  // Same resolution as nuxt-auth-utils: env password over runtime config
  const runtime = useRuntimeConfig()
  const session = (runtime.session ?? {}) as Record<string, any>
  return {
    ...session,
    name: session.name || 'nuxt-session',
    password: process.env.NUXT_SESSION_PASSWORD || session.password,
  }
}

/** Primary Base URL (cached 30 s): another name the site may be reached by */
let baseUrlCache: { value: string; until: number } | null = null
export async function primaryBaseUrl(): Promise<string> {
  const now = Date.now()
  if (baseUrlCache && now < baseUrlCache.until) return baseUrlCache.value
  const row = await prisma.setting.findUnique({ where: { key: 'primaryBaseUrl' } }).catch(() => null)
  baseUrlCache = { value: row?.value ?? '', until: now + 30_000 }
  return baseUrlCache.value
}

export interface SocketSession {
  userId: number
  /** When that login happened (0: before this was recorded) */
  loggedInAt: number
}

export async function socketSession(cookieHeader: string | undefined): Promise<SocketSession | null> {
  const config = sessionConfig()
  const sealed = readCookie(cookieHeader, config.name)
  if (!sealed || !config.password) return null
  try {
    const session = await unsealSession(undefined as any, config as any, sealed)
    const id = Number((session.data as any)?.user?.id)
    if (!Number.isInteger(id) || id <= 0) return null
    const user = await prisma.user.findUnique({ where: { id }, select: { active: true } })
    if (!user?.active) return null
    // A session logged out elsewhere cannot open sockets either
    if (await isSessionRevoked(session.data as any)) return null
    return { userId: id, loggedInAt: Number((session.data as any)?.loggedInAt) || 0 }
  } catch {
    return null
  }
}

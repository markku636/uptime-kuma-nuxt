// server/services/auth/session-revocation.ts
// Login sessions are sealed cookies (nothing stored on the server), so a
// session cannot be deleted. Instead each user has a "valid after" time:
// a session whose login (`loggedInAt`) is older is refused. Logging out
// other sessions (or changing the password) moves that time to now and
// re-issues the current session.
import type { H3Event } from 'h3'
import { prisma } from '../../utils/prisma'

const key = (userId: number) => `sessionsValidAfter:${userId}`
const cache = new Map<number, { after: number; until: number }>()
const CACHE_MS = 10_000

export async function sessionsValidAfter(userId: number): Promise<number> {
  const now = Date.now()
  const hit = cache.get(userId)
  if (hit && now < hit.until) return hit.after
  const row = await prisma.setting.findUnique({ where: { key: key(userId) } })
  const after = Number(row?.value) || 0
  cache.set(userId, { after, until: now + CACHE_MS })
  return after
}

/** Pure rule (tested): API-key requests are never "revoked" here */
export function isRevoked(data: { loggedInAt?: unknown; apiKeyId?: unknown } | null | undefined, validAfter: number): boolean {
  if (!data || data.apiKeyId != null || validAfter <= 0) return false
  const loggedInAt = Number(data.loggedInAt) || 0
  return loggedInAt < validAfter
}

export async function isSessionRevoked(data: { user?: { id?: unknown }; loggedInAt?: unknown; apiKeyId?: unknown }): Promise<boolean> {
  const userId = Number(data?.user?.id)
  if (!Number.isInteger(userId) || userId <= 0) return false
  return isRevoked(data, await sessionsValidAfter(userId))
}

/** End every other session of the user; the current one stays logged in */
export async function revokeOtherSessions(event: H3Event, userId: number): Promise<void> {
  const now = Date.now()
  await prisma.setting.upsert({
    where: { key: key(userId) },
    create: { key: key(userId), value: String(now), type: 'number' },
    update: { value: String(now), type: 'number' },
  })
  cache.set(userId, { after: now, until: now + CACHE_MS })
  const session = await getUserSession(event)
  if (session?.user) await setUserSession(event, { loggedInAt: now })
  // Sockets were authenticated at their handshake: close the ended sessions' ones
  // (this browser reconnects with its re-issued cookie)
  const { disconnectSessionsBefore } = await import('../socket')
  disconnectSessionsBefore(userId, now)
}

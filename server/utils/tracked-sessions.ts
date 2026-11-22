import type { H3Event } from 'h3'
import { prisma } from './prisma'

/** Session rows are the revocable counterpart of the encrypted auth cookie. */
const ACTIVE_TOUCH_INTERVAL_MS = 60_000

export function getTrackedSessionId(event: H3Event): string | undefined {
  const value = (event.context.trackedSessionId as string | undefined)
    || ((event.context.trackedSession as { sessionId?: unknown } | undefined)?.sessionId as string | undefined)
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : undefined
}

export function rememberTrackedSession(event: H3Event, id: string) {
  event.context.trackedSessionId = id
}

export async function createTrackedSession(event: H3Event, userId: number): Promise<string> {
  const userAgent = getHeader(event, 'user-agent') || null
  const ip = getRequestIP(event) || null
  const row = await prisma.userSession.create({
    data: { userId, userAgent: userAgent?.slice(0, 512) || null, ip: ip?.slice(0, 64) || null },
    select: { id: true },
  })
  rememberTrackedSession(event, row.id)
  return row.id
}

export async function assertTrackedSession(event: H3Event, userId: number, id: string | undefined) {
  if (!id) throw createError({ statusCode: 401, message: 'Session is no longer valid' })
  const row = await prisma.userSession.findFirst({
    where: { id, userId, revokedAt: null },
    select: { lastActive: true },
  })
  if (!row) throw createError({ statusCode: 401, message: 'Session is no longer valid' })
  rememberTrackedSession(event, id)
  if (Date.now() - row.lastActive.getTime() > ACTIVE_TOUCH_INTERVAL_MS) {
    // Best-effort activity stamp; a failed write must not break the request.
    try {
      await prisma.userSession.updateMany({
        where: { id, userId, revokedAt: null },
        data: { lastActive: new Date() },
      })
    } catch {
      // ignore
    }
  }
}

export async function revokeTrackedSession(id: string, userId: number) {
  return prisma.userSession.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllTrackedSessions(userId: number, exceptId?: string) {
  return prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { revokedAt: new Date() },
  })
}

export async function listTrackedSessions(userId: number, currentId: string | undefined) {
  const rows = await prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastActive: true },
    orderBy: { lastActive: 'desc' },
    take: 10,
  })
  return rows.map(row => ({ ...row, current: row.id === currentId }))
}

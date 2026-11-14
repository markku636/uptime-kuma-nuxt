import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { resolveWorkspace, type WorkspaceScope } from './workspace'

export interface RequestPrincipal extends WorkspaceScope {
  user: { id: number; username: string; timezone: string; active: boolean; platformAdmin: boolean; sessionVersion: number }
}

export function hashApiKey(key: string): string {
  return `sha256:${createHash('sha256').update(key).digest('hex')}`
}

/** The only principal resolver. API keys are deliberately limited to /api/v1. */
export async function getRequestSession(event: H3Event): Promise<RequestPrincipal | { user: null }> {
  if (event.context.requestSession) return event.context.requestSession as RequestPrincipal
  const path = getRequestURL(event).pathname
  const suppliedKey = path.startsWith('/api/v1/')
    ? getHeader(event, 'x-api-key') || getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
    : undefined

  let userId: number | undefined
  let sessionVersion: number | undefined
  let key: Awaited<ReturnType<typeof prisma.apiKey.findFirst>> | null = null
  if (suppliedKey) {
    if (!/^uk_[A-Za-z0-9_-]{24,128}$/.test(suppliedKey)) {
      throw createError({ statusCode: 401, message: 'Invalid API key format' })
    }
    key = await prisma.apiKey.findFirst({
      where: { key: hashApiKey(suppliedKey), active: true,
        OR: [{ expires: null }, { expires: { gt: new Date() } }] },
    })
    if (!key) throw createError({ statusCode: 401, message: 'Invalid or expired API key' })
    userId = key.userId
  } else {
    const session = await getUserSession(event)
    userId = session.user?.id as number | undefined
    sessionVersion = (session.user as { sessionVersion?: number } | undefined)?.sessionVersion ?? 0
  }
  if (!userId) return { user: null }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: {
    id: true, username: true, timezone: true, active: true, platformAdmin: true, sessionVersion: true,
  } })
  if (!user?.active || (!key && sessionVersion !== user.sessionVersion)) {
    throw createError({ statusCode: 401, message: 'Session is no longer valid' })
  }
  event.context.authMethod = key ? 'api-key' : 'session'
  event.context.apiKey = key
  const scope = await resolveWorkspace(event, user, key)
  event.context.requestSession = { user, ...scope }
  return event.context.requestSession as RequestPrincipal
}

export async function requireRequestSession(event: H3Event) {
  const session = await getRequestSession(event)
  if (!session.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  return session as RequestPrincipal
}

export async function requirePlatformAdmin(event: H3Event) {
  const session = await requireRequestSession(event)
  if (!session.user.platformAdmin || event.context.authMethod !== 'session') {
    throw createError({ statusCode: 403, message: 'Platform administrator session required' })
  }
  return session
}

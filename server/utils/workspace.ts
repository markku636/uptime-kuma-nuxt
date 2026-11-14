import type { H3Event } from 'h3'
import type { ApiKey } from '@prisma/client'
import { prisma } from './prisma'
import { requireRequestSession } from './request-session'

export type WorkspaceRole = 'owner' | 'editor' | 'viewer'
export interface WorkspaceScope { workspaceId: number; environmentId: number; role: WorkspaceRole }
const ranks = { viewer: 0, editor: 1, owner: 2 }

export async function ensurePersonalWorkspace(userId: number, username: string) {
  return prisma.workspace.upsert({ where: { personalUserId: userId }, update: {}, create: {
    name: `${username} workspace`, personalUserId: userId,
    members: { create: { userId, role: 'owner' } }, environments: { create: { name: 'default' } },
  } })
}

function positiveId(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) throw createError({ statusCode: 400, message: 'Invalid scope ID' })
  return number
}

export async function resolveWorkspace(event: H3Event, user: { id: number; username: string }, key: ApiKey | null): Promise<WorkspaceScope> {
  const pathname = getRequestURL(event).pathname
  const useSelection = pathname !== '/api/v1/workspaces' && (pathname.startsWith('/api/v1/') || pathname === '/api/auth/socket-ticket')
  const routeWorkspace = pathname.match(/^\/api\/v1\/workspaces\/(\d+)(?:\/|$)/)?.[1]
  const requested = positiveId(routeWorkspace || (useSelection ? getHeader(event, 'x-workspace-id') || getCookie(event, 'workspace_id') : undefined))
  let workspaceId = key?.workspaceId || requested
  if (key && requested && key.workspaceId !== requested) throw createError({ statusCode: 404, message: 'Workspace not found' })
  if (!workspaceId) {
    const first = await prisma.workspaceMember.findFirst({ where: { userId: user.id }, orderBy: { workspaceId: 'asc' } })
    workspaceId = first?.workspaceId || (await ensurePersonalWorkspace(user.id, user.username)).id
  }
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } })
  if (!membership || !(membership.role in ranks)) throw createError({ statusCode: 404, message: 'Workspace not found' })
  const requestedEnvironment = positiveId(useSelection && !routeWorkspace ? getHeader(event, 'x-environment-id') || getCookie(event, 'environment_id') : undefined)
  if (key?.environmentId && requestedEnvironment && key.environmentId !== requestedEnvironment) {
    throw createError({ statusCode: 404, message: 'Environment not found' })
  }
  const environment = await prisma.environment.findFirst({ where: { workspaceId,
    ...(key?.environmentId || requestedEnvironment ? { id: key?.environmentId || requestedEnvironment } : {}) }, orderBy: { id: 'asc' } })
  if (!environment) throw createError({ statusCode: 404, message: 'Environment not found' })
  return { workspaceId, environmentId: environment.id, role: membership.role as WorkspaceRole }
}

export async function requireWorkspace(event: H3Event, minimum: WorkspaceRole = 'viewer') {
  const session = await requireRequestSession(event)
  if (ranks[session.role] < ranks[minimum] || (event.context.authMethod === 'api-key'
    && (minimum === 'owner' || (minimum === 'editor' && event.context.apiKey.scope !== 'write')))) {
    throw createError({ statusCode: 403, message: 'Insufficient workspace permission' })
  }
  return session
}

/** All referenced IDs are checked within the caller's write transaction. */
export async function assertWorkspaceIds(tx: any, model: string, ids: unknown, workspaceId: number) {
  if (!Array.isArray(ids) || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || ids.length > 4000) {
    throw createError({ statusCode: 400, message: 'Invalid relation IDs' })
  }
  const unique = [...new Set(ids)]
  if (await tx[model].count({ where: { id: { in: unique }, workspaceId } }) !== unique.length) {
    throw createError({ statusCode: 404, message: 'Related resource not found' })
  }
  return unique as number[]
}

export async function requireMonitor(event: H3Event, minimum: WorkspaceRole = 'viewer') {
  const scope = await requireWorkspace(event, minimum)
  const id = positiveId(getRouterParam(event, 'id'))
  const monitor = id && await prisma.monitor.findFirst({ where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId } })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })
  return { scope, monitor }
}

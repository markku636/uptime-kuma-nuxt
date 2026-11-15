import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { io, type Socket } from 'socket.io-client'
export const prisma = new PrismaClient()
export const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:32511'
export interface Identity { id: number; username: string; cookie: string }
export interface Scope { workspaceId: number; environmentId: number }
export function headers(user?: Identity, scope?: Scope) {
  return { 'content-type': 'application/json', ...(user ? { cookie: user.cookie } : {}),
    ...(scope ? { 'x-workspace-id': String(scope.workspaceId), 'x-environment-id': String(scope.environmentId) } : {}) }
}
export async function request(path: string, method = 'GET', user?: Identity, scope?: Scope, body?: unknown, extra: Record<string,string> = {}) {
  return fetch(base + path, { method, signal: AbortSignal.timeout(10000), headers: { ...headers(user, scope), ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}
export async function data(response: Response, status = 200): Promise<any> {
  const body = await response.text(); assert.equal(response.status, status, body); return body ? JSON.parse(body) : undefined
}
export async function user(prefix: string): Promise<Identity> {
  const record = await prisma.user.create({ data: { username: prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,7), password: await bcrypt.hash('test-password', 4) } })
  const response = await request('/api/auth/login', 'POST', undefined, undefined, { username: record.username, password: 'test-password' })
  assert.equal(response.status, 200, await response.clone().text())
  return { id: record.id, username: record.username, cookie: response.headers.getSetCookie().map(x => x.split(';')[0]).join('; ') }
}
export async function workspace(user: Identity, name: string) {
  const response = await data(await request('/api/v1/workspaces','POST',user,undefined,{ name }))
  return { workspaceId: response.data.id, environmentId: response.data.environments[0].id } as Scope
}
export async function connect(user: Identity, scope: Scope): Promise<Socket> {
  const { ticket } = await data(await request('/api/auth/socket-ticket','POST',user,scope))
  const socket = io(base, { auth: { ticket }, extraHeaders:{Origin:base}, transports: ['websocket'], reconnection: false, timeout: 2000 })
  await new Promise<void>((resolve,reject) => { socket.once('connect',resolve); socket.once('connect_error',reject) })
  return socket
}
export async function cleanup(users: Identity[], scopes: Scope[]) {
  const workspaces = await prisma.workspace.findMany({ where: { OR: [{ personalUserId: { in: users.map(u => u.id) } }, { id: { in: scopes.map(s => s.workspaceId) } }] }, select: { id: true } })
  const ids = workspaces.map(w => w.id)
  await prisma.monitor.deleteMany({ where: { workspaceId: { in: ids } } })
  await prisma.workspace.deleteMany({ where: { id: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } }); await prisma.$disconnect()
}

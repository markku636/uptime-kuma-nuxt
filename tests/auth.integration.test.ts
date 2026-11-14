import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { io, type Socket } from 'socket.io-client'
import { createHash } from 'node:crypto'

// Run against an independently started local application and an isolated PostgreSQL database.
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:32510'
const prisma = new PrismaClient()
const users: number[] = []
let a: { id: number; cookie: string }, b: { id: number; cookie: string }, monitorId: number
const sockets: Socket[] = []
async function request(path: string, options: RequestInit = {}) {
  return fetch(base + path, { ...options, headers: { 'content-type': 'application/json', ...options.headers } })
}
async function login(name: string) {
  const user = await prisma.user.create({ data: { username: name + '-' + Date.now(), password: await bcrypt.hash('test-password', 4) } })
  users.push(user.id)
  const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: user.username, password: 'test-password' }) })
  assert.equal(response.status, 200, await response.text())
  return { id: user.id, cookie: response.headers.getSetCookie().map(x => x.split(';')[0]).join('; ') }
}
async function connect(cookie?: string, ticketOverride?: string) {
  let ticket = ticketOverride
  if (cookie) {
    const response = await request('/api/auth/socket-ticket', { method: 'POST', headers: { cookie } })
    assert.equal(response.status, 200)
    ticket = (await response.json()).ticket
  }
  const socket = io(base, { auth: { ticket }, transports: ['websocket'], reconnection: false, timeout: 2000 })
  sockets.push(socket)
  return new Promise<Socket>((resolve, reject) => {
    socket.once('connect', () => resolve(socket)); socket.once('connect_error', reject)
  })
}
before(async () => {
  a = await login('auth-a'); b = await login('auth-b')
  const response = await request('/api/v1/monitors', { method: 'POST', headers: { cookie: a.cookie }, body: JSON.stringify({
    name: 'private-monitor', type: 'http', url: 'http://127.0.0.1:39999/?token=PRIVATE', active: false,
    headers: { Authorization: 'Bearer SUPER-SECRET' }, basicAuthUser: 'user', basicAuthPass: 'SECRET',
  }) })
  assert.equal(response.status, 200, await response.clone().text())
  monitorId = (await response.json()).data.id
})
after(async () => {
  sockets.forEach(s => s.disconnect())
  const workspaces = await prisma.workspace.findMany({ where: { personalUserId: { in: users } }, select: { id: true } })
  await prisma.monitor.deleteMany({ where: { workspaceId: { in: workspaces.map(w => w.id) } } })
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces.map(w => w.id) } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect()
})
test('private REST endpoints and exact-path auth bypasses reject anonymous users', async () => {
  for (const path of ['/api/v1/monitors', '/api/auth/profile', '/api/cluster/nodes', '/api/auth/login-anything']) {
    assert.equal((await request(path)).status, 401, path)
  }
})
test('two users cannot read or modify each other monitors', async () => {
  for (const [suffix, method] of [['', 'GET'], ['', 'PUT'], ['', 'DELETE'], ['/clone', 'POST'], ['/pause', 'POST'], ['/resume', 'POST']]) {
    const response = await request(`/api/v1/monitors/${monitorId}${suffix}`, { method, headers: { cookie: b.cookie },
      ...(method === 'PUT' ? { body: JSON.stringify({ name: 'stolen' }) } : {}) })
    assert.equal(response.status, 404, method + suffix)
  }
})
test('API key authentication works without cookies, hashes are not bearer credentials', async () => {
  const response = await request('/api/v1/api-keys', { method: 'POST', headers: { cookie: a.cookie }, body: JSON.stringify({ name: 'integration key' }) })
  assert.equal(response.status, 200, await response.clone().text())
  const key = (await response.json()).key
  const hash = 'sha256:' + createHash('sha256').update(key).digest('hex')
  assert.equal((await prisma.apiKey.findUniqueOrThrow({ where: { key: hash } })).userId, a.id)
  assert.equal((await request('/api/v1/monitors', { headers: { 'x-api-key': key } })).status, 200)
  for (const value of [hash, 'uk_invalid-key-value-with-32-chars']) {
    assert.equal((await request('/api/v1/monitors', { headers: { 'x-api-key': value, cookie: a.cookie } })).status, 401)
  }
  await prisma.apiKey.update({ where: { key: hash }, data: { expires: new Date(Date.now() - 1000) } })
  assert.equal((await request('/api/v1/monitors', { headers: { 'x-api-key': key } })).status, 401)
  await prisma.apiKey.update({ where: { key: hash }, data: { expires: null, active: false } })
  assert.equal((await request('/api/v1/monitors', { headers: { 'x-api-key': key } })).status, 401)
})
test('list DTO excludes monitor credentials and URL query secrets', async () => {
  const response = await request('/api/v1/monitors', { headers: { cookie: a.cookie } })
  const body = await response.text()
  for (const secret of ['SUPER-SECRET', 'basicAuthPass', 'databaseConnectionString', 'token=PRIVATE']) assert.ok(!body.includes(secret), secret)
})
test('socket rejects anonymous and forged credentials, checks monitor ownership', async () => {
  await assert.rejects(connect(), /Unauthorized/)
  await assert.rejects(connect(undefined, 'fake.user.1'), /Unauthorized/)
  const socket = await connect(b.cookie)
  const result = await socket.timeout(2000).emitWithAck('subscribe_monitor', monitorId)
  assert.equal(result.ok, false)
  const mutation = await socket.timeout(2000).emitWithAck('deleteMonitor', monitorId)
  assert.equal(mutation.code, 'REST_REQUIRED')
})
test('disabled users cannot use existing cookie sessions or sockets', async () => {
  const socket = await connect(b.cookie)
  await prisma.user.update({ where: { id: b.id }, data: { active: false } })
  assert.equal((await request('/api/v1/monitors', { headers: { cookie: b.cookie } })).status, 401)
  await assert.rejects(connect(b.cookie))
  const disconnected = new Promise(resolve => socket.once('disconnect', resolve))
  socket.emit('subscribe_monitors'); await disconnected
  await prisma.user.update({ where: { id: b.id }, data: { active: true } })
})
test('logout invalidates existing sockets and signed tickets', async () => {
  const response = await request('/api/auth/socket-ticket', { method: 'POST', headers: { cookie: a.cookie } })
  const { ticket } = await response.json()
  const socket = await connect(a.cookie)
  const disconnected = new Promise(resolve => socket.once('disconnect', resolve))
  assert.equal((await request('/api/auth/logout', { method: 'POST', headers: { cookie: a.cookie } })).status, 200)
  await disconnected
  await assert.rejects(connect(undefined, ticket), /Unauthorized/)
  assert.equal((await request('/api/v1/monitors', { headers: { cookie: a.cookie } })).status, 401)
})

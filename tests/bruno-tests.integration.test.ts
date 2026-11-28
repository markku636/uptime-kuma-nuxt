import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { prisma, request, data, user, workspace, cleanup, type Identity, type Scope } from './helpers/http'

let owner: Identity, viewer: Identity, scope: Scope, other: Scope
let origin = ''

const manifest = (name: string) => ({
  collectionId: 'integration-flow',
  name,
  variables: { token: 'preview-placeholder' },
  files: [
    { path: 'bruno.json', content: JSON.stringify({ name: 'Integration flow', version: '1', type: 'collection' }) },
    { path: 'login.bru', content: `meta {\n  name: Login\n  type: http\n  seq: 1\n}\n\npost {\n  url: ${origin}/login\n  body: none\n  auth: none\n}\n\nvars:post-response {\n  token: res.body.token\n}\n\nassert {\n  res.status: eq 200\n}\n` },
    { path: 'list.bru', content: `meta {\n  name: List\n  type: http\n  seq: 2\n}\n\nget {\n  url: ${origin}/list\n  body: none\n  auth: bearer\n}\n\nauth:bearer {\n  token: {{token}}\n}\n\nassert {\n  res.status: eq 200\n  res.body.ok: eq true\n}\n` },
  ],
})

before(async () => {
  const fixture = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/login') return res.end(JSON.stringify({ token: 'fixture-token' }))
    if (req.url === '/list') {
      const ok = req.headers.authorization === 'Bearer fixture-token'
      res.statusCode = ok ? 200 : 401
      return res.end(JSON.stringify({ ok }))
    }
    res.statusCode = 404
    res.end('{}')
  })
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(fixture.address() as any).port}`
  ;(globalThis as any).__brunoFixture = fixture
  owner = await user('bruno-tests-owner')
  viewer = await user('bruno-tests-viewer')
  scope = await workspace(owner, 'Bruno tests')
  other = await workspace(owner, 'Bruno tests other')
  await data(await request(`/api/v1/workspaces/${scope.workspaceId}/members`, 'POST', owner, scope, { username: viewer.username, role: 'viewer' }))
})
after(async () => {
  await cleanup([owner, viewer], [scope, other])
  await new Promise<void>(resolve => (globalThis as any).__brunoFixture.close(() => resolve()))
})

test('a Bruno collection runs in order, extracts a token and produces a redacted report', { timeout: 40000 }, async () => {
  const body = manifest('Ordered flow')
  const preview = await data(await request('/api/v1/bruno/tests/preview', 'POST', owner, scope, body))
  assert.equal(preview.ok, true, JSON.stringify(preview.issues))
  assert.equal(preview.steps.length, 2)
  assert.deepEqual(preview.steps[0].extract.map((row: any) => row.name), ['token'])

  const created = await data(await request('/api/v1/bruno/tests', 'POST', owner, scope, { ...body, digest: preview.digest }))
  assert.equal(created.data.steps, 2)

  const run = await data(await request(`/api/v1/bruno/tests/${created.data.id}/run`, 'POST', owner, scope))
  assert.equal(run.data.status, 'pass', JSON.stringify(run.data))
  assert.equal(run.data.summary.passed, 2)

  const report = await data(await request(`/api/v1/bruno/tests/${created.data.id}/runs/${run.data.runId}`, 'GET', owner, scope))
  assert.deepEqual(report.data.steps.map((row: any) => row.status), ['pass', 'pass'])
  assert.deepEqual(report.data.steps[0].extractedNames, ['token'])
  assert.ok(!JSON.stringify(report.data).includes('fixture-token'))

  const csv = await (await request(`/api/v1/bruno/tests/${created.data.id}/runs/${run.data.runId}/export?format=csv`, 'GET', owner, scope)).text()
  assert.match(csv, /Login/)
  assert.ok(!csv.includes('fixture-token'))

  assert.equal((await request(`/api/v1/bruno/tests/${created.data.id}/run`, 'POST', viewer, scope)).status, 403)
  assert.equal((await request(`/api/v1/bruno/tests/${created.data.id}`, 'GET', owner, other)).status, 404)
  assert.equal((await request(`/api/v1/bruno/tests/${created.data.id}/runs/${run.data.runId}`, 'GET', viewer, scope)).status, 200)
})

test('a suite can opt into a bounded schedule and reject unsupported intervals', { timeout: 40000 }, async () => {
  const body = manifest('Scheduled flow')
  const prepared = await data(await request('/api/v1/bruno/tests/preview', 'POST', owner, scope, body))
  const suite = await data(await request('/api/v1/bruno/tests', 'POST', owner, scope, { ...body, digest: prepared.digest }))
  const invalid = await request(`/api/v1/bruno/tests/${suite.data.id}`, 'PUT', owner, scope, { scheduleIntervalSec: 60 })
  assert.equal(invalid.status, 400)
  const updated = await data(await request(`/api/v1/bruno/tests/${suite.data.id}`, 'PUT', owner, scope, { scheduleIntervalSec: 300 }))
  assert.equal(updated.data.scheduleIntervalSec, 300)
  assert.ok(updated.data.nextRunAt)
  const off = await data(await request(`/api/v1/bruno/tests/${suite.data.id}`, 'PUT', owner, scope, { scheduleIntervalSec: 0 }))
  assert.equal(off.data.scheduleIntervalSec, null)
  assert.equal(off.data.nextRunAt, null)
})

test('unsafe extraction blocks suite creation and concurrent runs are rejected', { timeout: 40000 }, async () => {
  const body = manifest('Rejected flow')
  body.files[1]!.content = body.files[1]!.content.replace('token: res.body.token', 'token: bru.setVar("t", res.body.token)')
  const preview = await data(await request('/api/v1/bruno/tests/preview', 'POST', owner, scope, body))
  assert.equal(preview.ok, false)
  assert.ok(preview.issues.some((issue: any) => issue.code === 'UNSUPPORTED_EXTRACTION'))

  const good = manifest('Concurrent flow')
  const prepared = await data(await request('/api/v1/bruno/tests/preview', 'POST', owner, scope, good))
  const suite = await data(await request('/api/v1/bruno/tests', 'POST', owner, scope, { ...good, digest: prepared.digest }))
  // Hold the single-flight slot open with a manual running row, as a second pod would see it.
  await prisma.brunoTestRun.create({ data: { workspaceId: scope.workspaceId, suiteId: suite.data.id, status: 'running',
    triggeredBy: owner.id, summary: {} } })
  assert.equal((await request(`/api/v1/bruno/tests/${suite.data.id}/run`, 'POST', owner, scope)).status, 409)
})

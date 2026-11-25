import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {user,workspace,cleanup,request,data,type Identity,type Scope} from './helpers/http'

let owner: Identity, editor: Identity, viewer: Identity, a: Scope, b: Scope
const secret = 'editor-secret-do-not-leak'
const source = (origin: string) => `meta {
  name: Editor API
  type: http
}

get {
  url: ${origin}/health
  body: none
  auth: none
}

headers {
  X-Token: {{TOKEN}}
}

assert {
  res.status: eq 200
}
`

before(async () => {
  owner = await user('bruno-editor-owner')
  editor = await user('bruno-editor-editor')
  viewer = await user('bruno-editor-viewer')
  a = await workspace(owner, 'Bruno editor API')
  b = await workspace(owner, 'Bruno editor other')
  for (const [identity, role] of [[editor, 'editor'], [viewer, 'viewer']] as const) {
    await data(await request(`/api/v1/workspaces/${a.workspaceId}/members`, 'POST', owner, a, {username: identity.username, role}))
  }
  await data(await request(`/api/v1/workspaces/${a.workspaceId}/environments/${a.environmentId}`, 'PUT', owner, a, {secrets: {TOKEN: secret}}))
})
after(async () => {
  if (owner && a && b) await cleanup([owner, editor, viewer], [a, b])
})

test('parse/stringify are editor-only, workspace-scoped and never leak secret values', async () => {
  const payload = {source: source('http://127.0.0.1:1/health'), environmentId: a.environmentId}
  assert.equal((await request('/api/v1/bruno/request/parse', 'POST', viewer, a, payload)).status, 403)
  const cross = await request('/api/v1/bruno/request/parse', 'POST', owner, a, {...payload, environmentId: b.environmentId})
  assert.ok([400, 404].includes(cross.status), await cross.text())

  const parsed = await data(await request('/api/v1/bruno/request/parse', 'POST', editor, a, payload))
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.data.issues, [])
  assert.equal(parsed.data.model.name, 'Editor API')
  assert.equal(parsed.data.model.method, 'GET')
  assert.equal(parsed.data.model.headers[0].value, '{{TOKEN}}')
  assert.ok(!JSON.stringify(parsed).includes(secret))

  const stringified = await data(await request('/api/v1/bruno/request/stringify', 'POST', editor, a, {model: parsed.data.model, environmentId: a.environmentId}))
  assert.equal(stringified.ok, true)
  assert.deepEqual(stringified.data.issues, [])
  assert.match(stringified.data.source, /X-Token: \{\{TOKEN\}\}/)
  assert.ok(!JSON.stringify(stringified).includes(secret))

  const again = await data(await request('/api/v1/bruno/request/parse', 'POST', editor, a, {source: stringified.data.source, environmentId: a.environmentId}))
  assert.equal(again.data.model.name, parsed.data.model.name)
  assert.deepEqual(again.data.model.assertions, parsed.data.model.assertions)
  assert.ok(!JSON.stringify(again).includes(secret))
})

test('invalid .bru returns safe issue codes instead of parser exceptions', async () => {
  const result = await data(await request('/api/v1/bruno/request/parse', 'POST', editor, a, {source: 'script { req: whatever }\nget { url: http://127.0.0.1/health }', environmentId: a.environmentId}))
  assert.equal(result.ok, true)
  assert.equal(result.data.model, null)
  assert.ok(result.data.issues.length > 0)
  assert.ok(result.data.issues.every((issue: any) => /^[A-Z_]+$/.test(issue.code)))
})

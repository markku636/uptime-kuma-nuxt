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

test('existing monitor trial reports missing variables as CONFIG_ERROR instead of a 500', async () => {
  const created = await data(await request('/api/v1/monitors', 'POST', owner, a, {
    type: 'bruno', name: 'Missing variable Bruno', active: false,
    body: 'meta {\n  name: Missing\n  type: http\n}\nget {\n  url: http://127.0.0.1:1/{{MISSING_EDITOR_VAR}}\n  body: none\n  auth: none\n}\n',
  }))
  const id = created.data.id
  const trial = await data(await request(`/api/v1/monitors/${id}/test`, 'POST', owner, a, {}))
  assert.equal(trial.ok, true)
  assert.equal(trial.data.code, 'CONFIG_ERROR')
})

test('Bruno .bru source is only readable by an interactive editor session', async () => {
  const created = await data(await request('/api/v1/monitors', 'POST', owner, a, {
    type: 'bruno', name: 'Source visibility', active: false,
    body: 'meta {\n  name: Visible\n  type: http\n}\nget {\n  url: http://127.0.0.1:1/health\n  body: none\n  auth: bearer\n}\nauth:bearer {\n  token: SECRET_TOKEN_SENTINEL\n}\n',
  }))
  const id = created.data.id
  const bySession = await data(await request(`/api/v1/monitors/${id}`, 'GET', owner, a))
  assert.match(bySession.data.body, /SECRET_TOKEN_SENTINEL/)

  for (const scope of ['read', 'write'] as const) {
    const key = await data(await request('/api/v1/api-keys', 'POST', owner, a, {name: `bruno-source-${scope}`, scope})) as any
    const response = await data(await request(`/api/v1/monitors/${id}`, 'GET', undefined, a, undefined, {'x-api-key': key.key}))
    assert.ok(!Object.hasOwn(response.data, 'body'), `${scope} key must not read the .bru source`)
    assert.ok(!JSON.stringify(response).includes('SECRET_TOKEN_SENTINEL'))
    if (scope === 'write') {
      const updated = await data(await request(`/api/v1/monitors/${id}`, 'PUT', undefined, a, {name: 'Source visibility renamed'}, {'x-api-key': key.key}))
      assert.ok(!Object.hasOwn(updated.data, 'body'), 'write key must not read the source from a mutation response')
    }
    await request(`/api/v1/api-keys/${key.id}`, 'DELETE', owner, a)
  }

  const viewerResponse = await data(await request(`/api/v1/monitors/${id}`, 'GET', viewer, a))
  assert.ok(!Object.hasOwn(viewerResponse.data, 'body'))
  assert.ok(!JSON.stringify(viewerResponse).includes('SECRET_TOKEN_SENTINEL'))
})

test('stringify rejects oversized model payloads with a bounded error', async () => {
  const model = {
    name: 'Huge', method: 'GET', url: 'https://example.com', params: [], headers: [],
    auth: {mode: 'none'}, body: {mode: 'none', content: ''}, vars: [], assertions: [], ignoredBlocks: [],
    docs: 'x'.repeat(3 * 1024 * 1024),
  }
  const response = await request('/api/v1/bruno/request/stringify', 'POST', editor, a, {model, environmentId: a.environmentId})
  assert.equal(response.status, 413)
  const text = await response.text()
  assert.ok(!text.includes('x'.repeat(100)))
})

test('downloading a Bruno monitor never returns its literal credentials', async () => {
  const source = `meta {
  name: Secret export
  type: http
}

post {
  url: https://example.com/login
  body: none
  auth: bearer
}

auth:bearer {
  token: literal-bearer-token
}
`
  const created = await data(await request('/api/v1/monitors', 'POST', owner, a, {type:'bruno', name:'Secret export', active:false, body:source}))
  const response = await request(`/api/v1/bruno/download?ids=${created.data.id}`, 'GET', owner, a)
  assert.equal(response.status, 200)
  const text = await response.text()
  assert.ok(!text.includes('literal-bearer-token'))
  assert.match(response.headers.get('x-bruno-secret-names') || '', /token/)
})

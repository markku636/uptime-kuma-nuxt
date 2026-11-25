import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceToModel, modelToSource } from '../server/services/bruno/request-editor'
import type { BrunoRequestModel } from '../shared/types/bruno'

const VALUES = { ORIGIN: 'https://example.com', TOKEN: 'TOP_SECRET_VALUE', PAGE: '1' }
const SECRETS = ['TOKEN']

const FULL_SOURCE = `meta {
  name: Full request
  type: http
  seq: 1
}

post {
  url: {{ORIGIN}}/api?page=1&token={{TOKEN}}
  body: json
  auth: bearer
}

params:query {
  page: 1
  token: {{TOKEN}}
  ~off: no
}

headers {
  Content-Type: application/json
  X-Token: {{TOKEN}}
  ~X-Old: gone
}

auth:bearer {
  token: {{TOKEN}}
}

body:json {
  {"token": "{{TOKEN}}"}
}

vars:pre-request {
  foo: bar
  ~off: nope
}

assert {
  @description('Status is ok')
  res.status: eq 200
  res.status: ne 201
  res.status: neq 202
  res.status: gt 100
  res.status: gte 200
  res.status: lt 500
  res.status: lte 499
  res.body.name: contains "ok"
  res.body.name: notContains "bad"
  res.body.name: exists
  res.body.name: notExists
  res.body.name: isNull
  res.body.name: isNotNull
}

script:pre-request {
  req.setHeader('X-Ignored', '1');
}

tests {
  test("ignored", () => {});
}

vars:post-response {
  saved: value
}

settings {
  encodeUrl: false
}
`

const baseModel = (): BrunoRequestModel => ({
  name: 'Minimal',
  method: 'GET',
  url: 'https://example.com/health',
  params: [],
  headers: [],
  auth: { mode: 'none' },
  body: { mode: 'none', content: '' },
  vars: [],
  assertions: [],
  ignoredBlocks: [],
})

test('full .bru → model → .bru → model round-trip covers all six tabs without leaking secrets', async () => {
  const parsed = await sourceToModel(FULL_SOURCE, VALUES, SECRETS)
  assert.deepEqual(parsed.issues, [])
  const model = parsed.model!
  assert.ok(model)

  assert.equal(model.name, 'Full request')
  assert.equal(model.method, 'POST')
  // Params are authoritative: the query string is removed from the model URL.
  assert.equal(model.url, '{{ORIGIN}}/api')
  assert.deepEqual(model.params, [
    { name: 'page', value: '1', enabled: true },
    { name: 'token', value: '{{TOKEN}}', enabled: true },
    { name: 'off', value: 'no', enabled: false },
  ])
  assert.deepEqual(model.headers, [
    { name: 'Content-Type', value: 'application/json', enabled: true },
    { name: 'X-Token', value: '{{TOKEN}}', enabled: true },
    { name: 'X-Old', value: 'gone', enabled: false },
  ])
  assert.deepEqual(model.auth, { mode: 'bearer', token: '{{TOKEN}}' })
  assert.deepEqual(model.body, { mode: 'json', content: '{"token": "{{TOKEN}}"}' })
  assert.deepEqual(model.vars, [
    { name: 'foo', value: 'bar', enabled: true },
    { name: 'off', value: 'nope', enabled: false },
  ])
  assert.deepEqual(model.assertions, [
    { expression: 'res.status', operator: 'eq', value: '200', enabled: true, description: 'Status is ok' },
    { expression: 'res.status', operator: 'ne', value: '201', enabled: true },
    { expression: 'res.status', operator: 'neq', value: '202', enabled: true },
    { expression: 'res.status', operator: 'gt', value: '100', enabled: true },
    { expression: 'res.status', operator: 'gte', value: '200', enabled: true },
    { expression: 'res.status', operator: 'lt', value: '500', enabled: true },
    { expression: 'res.status', operator: 'lte', value: '499', enabled: true },
    { expression: 'res.body.name', operator: 'contains', value: '"ok"', enabled: true },
    { expression: 'res.body.name', operator: 'notContains', value: '"bad"', enabled: true },
    { expression: 'res.body.name', operator: 'exists', value: '', enabled: true },
    { expression: 'res.body.name', operator: 'notExists', value: '', enabled: true },
    { expression: 'res.body.name', operator: 'isNull', value: '', enabled: true },
    { expression: 'res.body.name', operator: 'isNotNull', value: '', enabled: true },
  ])
  assert.deepEqual(model.ignoredBlocks, ['script', 'tests', 'post-response vars', 'settings'])
  assert.ok(!JSON.stringify(model).includes('TOP_SECRET_VALUE'))

  const stringified = await modelToSource(model, VALUES, SECRETS)
  assert.deepEqual(stringified.issues, [])
  const source = stringified.source!
  assert.ok(source)
  assert.match(source, /^meta \{/)
  assert.match(source, /auth: bearer/)
  assert.match(source, /token: \{\{TOKEN\}\}/)
  assert.match(source, /@description\('Status is ok'\)/)
  assert.ok(!source.includes('authorization:'))
  assert.match(source, /script:pre-request \{/)
  assert.match(source, /tests \{/)
  assert.match(source, /vars:post-response \{/)
  assert.ok(!source.includes('TOP_SECRET_VALUE'))
  const urlLine = source.split('\n').find(line => line.trim().startsWith('url:'))!
  assert.equal((urlLine.match(/\?/g) || []).length, 1, urlLine)
  assert.equal((urlLine.match(/page=/g) || []).length, 1, urlLine)

  const again = await sourceToModel(source, VALUES, SECRETS)
  assert.deepEqual(again.issues, [])
  // Saving from UI mode keeps the non-executed blocks verbatim.
  assert.deepEqual(again.model, model)
})

test('basic and bearer auth round-trip without an ambiguous Authorization header', async () => {
  for (const [mode, block] of [
    ['basic', 'auth:basic {\n  username: admin\n  password: {{TOKEN}}\n}\n'],
    ['bearer', 'auth:bearer {\n  token: {{TOKEN}}\n}\n'],
  ] as const) {
    const source = `meta {\n name: Auth ${mode}\n}\npost {\n url: https://example.com/login\n body: none\n auth: ${mode}\n}\n${block}`
    const parsed = await sourceToModel(source, VALUES, SECRETS)
    assert.deepEqual(parsed.issues, [])
    assert.equal(parsed.model!.auth.mode, mode)
    const produced = await modelToSource(parsed.model!, VALUES, SECRETS)
    assert.deepEqual(produced.issues, [], mode)
    assert.ok(!produced.source!.includes('authorization:'), mode)
    const back = await sourceToModel(produced.source!, VALUES, SECRETS)
    assert.deepEqual(back.issues, [])
    assert.deepEqual(back.model!.auth, parsed.model!.auth)
  }

  // A stale Authorization header supplied by the UI is dropped rather than failing validation.
  const model = baseModel()
  model.auth = { mode: 'basic', username: 'admin', password: '{{TOKEN}}' }
  model.headers.push({ name: 'Authorization', value: 'Basic stale', enabled: true })
  const produced = await modelToSource(model, VALUES, SECRETS)
  assert.deepEqual(produced.issues, [])
  assert.ok(!produced.source!.includes('authorization:'))
})

test('query params are rebuilt once, with or without an existing URL query', async () => {
  const model = baseModel()
  model.params = [
    { name: 'page', value: '1', enabled: true },
    { name: 'token', value: '{{TOKEN}}', enabled: true },
    { name: 'off', value: 'no', enabled: false },
  ]
  model.url = 'https://example.com/api?page=1&token={{TOKEN}}#frag' as string
  const produced = await modelToSource(model, VALUES, SECRETS)
  assert.deepEqual(produced.issues, [])
  const urlLine = produced.source!.split('\n').find(line => line.trim().startsWith('url:'))!
  assert.equal((urlLine.match(/\?/g) || []).length, 1, urlLine)
  assert.ok(urlLine.includes('page=1&token={{TOKEN}}#frag'), urlLine)
  assert.ok(!urlLine.includes('off=no'), urlLine)
  const back = await sourceToModel(produced.source!, VALUES, SECRETS)
  assert.deepEqual(back.issues, [])
  assert.equal(back.model!.url, 'https://example.com/api#frag')
  assert.deepEqual(back.model!.params, model.params)
})

test('json and text bodies round-trip and keep placeholders verbatim', async () => {
  for (const [mode, content] of [
    ['json', '{"ok": true}'],
    ['text', 'plain {{TOKEN}} body'],
  ] as const) {
    const model = baseModel()
    model.body = { mode, content }
    const produced = await modelToSource(model, VALUES, SECRETS)
    assert.deepEqual(produced.issues, [], mode)
    assert.ok(!produced.source!.includes('TOP_SECRET_VALUE'))
    const back = await sourceToModel(produced.source!, VALUES, SECRETS)
    assert.deepEqual(back.issues, [])
    assert.deepEqual(back.model!.body, model.body)
  }
})

test('ignored blocks are reported by kind, including behaviour-changing settings', async () => {
  const parsed = await sourceToModel(FULL_SOURCE, VALUES, SECRETS)
  assert.deepEqual(parsed.model!.ignoredBlocks, ['script', 'tests', 'post-response vars', 'settings'])

  const defaultSettings = FULL_SOURCE.replace('encodeUrl: false', 'encodeUrl: true').replace('  timeout: 5000\n', '')
  const withoutSettings = await sourceToModel(defaultSettings, VALUES, SECRETS)
  assert.deepEqual(withoutSettings.issues, [])
  assert.ok(!withoutSettings.model!.ignoredBlocks.includes('settings'))
})

test('invalid .bru sources yield safe issue codes and never echo secret values', async () => {
  const cases: Array<[string, string]> = [
    ['get {\n url: https://example.com/\n}\npost {\n url: https://example.com/\n}\n', 'DUPLICATE_HTTP_BLOCK'],
    ['get {\n url: https://example.com/\n}\nget {\n url: https://example.com/\n}\n', 'DUPLICATE_BLOCK'],
    ['mystery {\n TOP_SECRET_VALUE\n}\n', 'UNSUPPORTED_BLOCK'],
    ['unknown: TOP_SECRET_VALUE\n', 'UNSUPPORTED_SYNTAX'],
    ['x'.repeat(131073), 'FILE_TOO_LARGE'],
    ['get {\n url: https://example.com/\n unknown: TOP_SECRET_VALUE\n}\n', 'UNSUPPORTED_FIELD'],
  ]
  for (const [extra, code] of cases) {
    const result = await sourceToModel(extra, VALUES, SECRETS)
    assert.equal(result.model, null)
    assert.ok(result.issues.some(issue => issue.code === code), `${code}: ${JSON.stringify(result.issues)}`)
    assert.ok(!JSON.stringify(result.issues).includes('TOP_SECRET_VALUE'), code)
  }
})

test('invalid models return null source with safe issues', async () => {
  const badMethod = baseModel()
  ;(badMethod as any).method = 'TRACE'
  let result = await modelToSource(badMethod, VALUES, SECRETS)
  assert.equal(result.source, null)
  assert.ok(result.issues.some(issue => issue.code === 'UNSUPPORTED_METHOD'))

  const badAuth = baseModel()
  ;(badAuth.auth as any).mode = 'digest'
  result = await modelToSource(badAuth, VALUES, SECRETS)
  assert.equal(result.source, null)
  assert.ok(result.issues.some(issue => issue.code === 'UNSUPPORTED_AUTH'))

  const missingVariable = baseModel()
  missingVariable.url = 'https://example.com/{{NOT_IN_ENV}}'
  result = await modelToSource(missingVariable, VALUES, SECRETS)
  assert.equal(result.source, null)
  assert.ok(result.issues.some(issue => issue.code === 'MISSING_VARIABLE'))

  const huge = baseModel()
  huge.params = Array.from({ length: 101 }, () => ({ name: 'x', value: '1', enabled: true }))
  result = await modelToSource(huge, VALUES, SECRETS)
  assert.equal(result.source, null)
  assert.ok(result.issues.some(issue => issue.code === 'INVALID_FIELD'))
})

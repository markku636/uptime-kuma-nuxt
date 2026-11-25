import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceToModel, modelToSource } from '../server/services/bruno/request-editor'
import type { BrunoRequestModel } from '../shared/types/bruno'

const VALUES = { ORIGIN: 'https://example.com', TOKEN: 'TOP_SECRET_VALUE', COUNT: '2', NAME: 'alice' }
const SECRETS = ['TOKEN']
const model = (overrides: Partial<BrunoRequestModel> = {}): BrunoRequestModel => ({
  name: 'Variants', method: 'GET', url: 'https://example.com/health',
  params: [], headers: [], auth: { mode: 'none' },
  body: { mode: 'none', content: '' }, vars: [], assertions: [], ignoredBlocks: [],
  ...overrides,
})

async function roundTrip(input: BrunoRequestModel) {
  const produced = await modelToSource(input, VALUES, SECRETS)
  assert.deepEqual(produced.issues, [], JSON.stringify(produced.issues))
  assert.ok(produced.source)
  const parsed = await sourceToModel(produced.source, VALUES, SECRETS)
  assert.deepEqual(parsed.issues, [], JSON.stringify(parsed.issues))
  assert.ok(parsed.model)
  return { source: produced.source!, model: parsed.model }
}

const assertions: Array<{ label: string; expression: string; operator: string; value: string; description?: string }> = [
  { label: 'status equals', expression: 'res.status', operator: 'eq', value: '200' },
  { label: 'status not equal (ne)', expression: 'res.status', operator: 'ne', value: '404' },
  { label: 'status not equal (neq)', expression: 'res.status', operator: 'neq', value: '500' },
  { label: 'status greater than', expression: 'res.status', operator: 'gt', value: '199' },
  { label: 'status greater or equal', expression: 'res.status', operator: 'gte', value: '200' },
  { label: 'status less than', expression: 'res.status', operator: 'lt', value: '600' },
  { label: 'status less or equal', expression: 'res.status', operator: 'lte', value: '599' },
  { label: 'elapsed time', expression: 'res.responseTime', operator: 'lte', value: '3000' },
  { label: 'text contains', expression: 'res.text', operator: 'contains', value: '"ok"', description: 'body mentions ok' },
  { label: 'text not contains', expression: 'res.text', operator: 'notContains', value: '"fail"' },
  { label: 'json string', expression: 'res.body.name', operator: 'eq', value: '"alice"' },
  { label: 'json number', expression: 'res.body.count', operator: 'eq', value: '2' },
  { label: 'json boolean', expression: 'res.body.active', operator: 'eq', value: 'true' },
  { label: 'json array', expression: 'res.body.tags', operator: 'eq', value: '["a","b"]' },
  { label: 'json nested path', expression: 'res.body.data.id', operator: 'eq', value: '7' },
  { label: 'header value', expression: 'res.headers.X-Fixture', operator: 'eq', value: '"ready"' },
  { label: 'exists', expression: 'res.body.name', operator: 'exists', value: '' },
  { label: 'notExists', expression: 'res.body.missing', operator: 'notExists', value: '' },
  { label: 'isNull', expression: 'res.body.nil', operator: 'isNull', value: '' },
  { label: 'isNotNull', expression: 'res.body.name', operator: 'isNotNull', value: '' },
  { label: 'in list', expression: 'res.body.name', operator: 'in', value: '["alice","bob"]' },
  { label: 'not in list', expression: 'res.body.name', operator: 'notIn', value: '["carol"]' },
  { label: 'status in list', expression: 'res.status', operator: 'in', value: '[200,201]' },
  { label: 'starts with', expression: 'res.text', operator: 'startsWith', value: '"ok"' },
  { label: 'ends with', expression: 'res.text', operator: 'endsWith', value: '"done"' },
  { label: 'array length', expression: 'res.body.items', operator: 'length', value: '2' },
  { label: 'is empty', expression: 'res.body.optional', operator: 'isEmpty', value: '' },
  { label: 'is not empty', expression: 'res.body.name', operator: 'isNotEmpty', value: '' },
  { label: 'is JSON string', expression: 'res.text', operator: 'isJson', value: '' },
  { label: 'is number', expression: 'res.body.count', operator: 'isNumber', value: '' },
  { label: 'is string', expression: 'res.body.name', operator: 'isString', value: '' },
  { label: 'is boolean', expression: 'res.body.active', operator: 'isBoolean', value: '' },
  { label: 'is array', expression: 'res.body.items', operator: 'isArray', value: '' },
  { label: 'between', expression: 'res.status', operator: 'between', value: '200 299' },
  { label: 'is defined', expression: 'res.body.name', operator: 'isDefined', value: '' },
  { label: 'is undefined', expression: 'res.body.missing', operator: 'isUndefined', value: '' },
  { label: 'is truthy', expression: 'res.body.active', operator: 'isTruthy', value: '' },
  { label: 'is falsy', expression: 'res.body.inactive', operator: 'isFalsy', value: '' },
]

for (const variant of assertions) {
  test(`assertion variant: ${variant.label}`, async () => {
    const input = model({ assertions: [{ expression: variant.expression, operator: variant.operator, value: variant.value, enabled: true, ...(variant.description ? { description: variant.description } : {}) }] })
    const result = await roundTrip(input)
    assert.equal(result.model.assertions.length, 1)
    assert.equal(result.model.assertions[0]!.expression, variant.expression)
    assert.equal(result.model.assertions[0]!.operator, variant.operator)
    assert.equal(result.model.assertions[0]!.value, variant.value)
    if (variant.description) assert.equal(result.model.assertions[0]!.description, variant.description)
  })
}

test('mixed assertion set with enabled and disabled rows survives serialization', async () => {
  const input = model({
    assertions: [
      { expression: 'res.status', operator: 'eq', value: '200', enabled: true, description: 'healthy' },
      { expression: 'res.body.debug', operator: 'exists', value: '', enabled: false },
      { expression: 'res.headers.Content-Type', operator: 'contains', value: '"json"', enabled: true },
      { expression: 'res.responseTime', operator: 'lt', value: '1500', enabled: true },
    ],
  })
  const result = await roundTrip(input)
  assert.equal(result.model.assertions.length, 4, 'disabled assertions are preserved with the ~ prefix')
  assert.deepEqual(result.model.assertions.map(row => row.operator), ['eq', 'contains', 'lt', 'exists'], 'disabled rows are written last')
  assert.equal(result.model.assertions[3]!.enabled, false)
  assert.match(result.source, /@description\('healthy'\)/)
  assert.match(result.source, /~res\.body\.debug: exists/)
})

test('parameter variants: disabled rows, placeholders, empty values and fragments', async () => {
  const input = model({
    url: '{{ORIGIN}}/search?existing=1#results',
    params: [
      { name: 'q', value: '{{NAME}}', enabled: true },
      { name: 'page', value: '2', enabled: true },
      { name: 'empty', value: '', enabled: true },
      { name: 'off', value: 'no', enabled: false },
      { name: 'token', value: '{{TOKEN}}', enabled: true },
    ],
    headers: [
      { name: 'X-Name', value: '{{NAME}}', enabled: true },
      { name: 'X-Old', value: 'gone', enabled: false },
    ],
  })
  const result = await roundTrip(input)
  assert.deepEqual(result.model.params.map(row => row.name), ['q', 'page', 'empty', 'token', 'off'], 'disabled rows are written last')
  assert.deepEqual(result.model.headers.map(row => row.name), ['X-Name', 'X-Old'])
  assert.equal(result.model.params[4]!.enabled, false)
  assert.equal(result.model.url, '{{ORIGIN}}/search#results', 'query is owned by params:query')
  assert.match(result.source, /q: \{\{NAME\}\}/)
  assert.match(result.source, /~off: no/)
  assert.ok(!JSON.stringify(result.model).includes('TOP_SECRET_VALUE'))
})

test('many parameters keep order and variable names in values', async () => {
  const params = Array.from({length: 20}, (_, index) => ({name: `p${index}`, value: `{{NAME}}-${index}`, enabled: true}))
  const result = await roundTrip(model({params}))
  assert.deepEqual(result.model.params, params)
  const url = result.source.split('\n').find(line => line.trim().startsWith('url:'))!
  assert.equal((url.match(/\?/g) || []).length, 1)
  for (const param of params) assert.ok(url.includes(`${param.name}=`), url)
})

test('body and vars variants: multiline text, nested JSON and disabled vars', async () => {
  const cases: Array<{ body: BrunoRequestModel['body']; expected: string }> = [
    { body: {mode: 'text', content: 'line one\nline two'}, expected: 'line two' },
    { body: {mode: 'json', content: '{"nested":{"count":{{COUNT}},"name":"{{NAME}}"}}'}, expected: '"name":"{{NAME}}"' },
  ]
  for (const item of cases) {
    const input = model({
      method: 'POST', url: 'https://example.com/api', body: item.body,
      vars: [
        { name: 'keep', value: '{{NAME}}', enabled: true },
        { name: 'skip', value: 'nope', enabled: false },
      ],
    })
    const result = await roundTrip(input)
    assert.deepEqual(result.model.body, item.body)
    assert.ok(result.source.includes(item.expected))
    assert.deepEqual(result.model.vars, input.vars, 'disabled pre-request vars are preserved')
  }
})

test('unsupported assertion operators and expressions are rejected with safe codes', async () => {
  for (const operator of ['matches', 'notMatches']) {
    const result = await modelToSource(model({assertions: [{expression: 'res.body.name', operator, value: '"x"', enabled: true}]}), VALUES, SECRETS)
    assert.equal(result.source, null, operator)
    assert.ok(result.issues.some(issue => issue.code === 'UNSUPPORTED_ASSERTION'), `${operator}: ${JSON.stringify(result.issues)}`)
  }
  const unknown = await modelToSource(model({assertions: [{expression: 'res.foobar', operator: 'eq', value: '1', enabled: true}]}), VALUES, SECRETS)
  assert.equal(unknown.source, null)
  assert.ok(unknown.issues.some(issue => issue.code === 'UNSUPPORTED_ASSERTION'))
})

test('nested JSON bodies are valid even though they end with }}', async () => {
  const bodies = [
    '{"nested":{"count":2}}',
    '{"a":{"b":{"c":"{{NAME}}"}}}',
    '{"items":[{"id":1},{"id":2}]}',
    '{"literal":"ends with }}"}',
  ]
  for (const content of bodies) {
    const result = await roundTrip(model({method: 'POST', url: 'https://example.com/api', body: {mode: 'json', content}}))
    assert.deepEqual(result.model.body, {mode: 'json', content})
  }
})

test('unmatched variable openers are still rejected', async () => {
  const source = `meta {\n  name: Bad\n  type: http\n}\nget {\n  url: https://example.com/{{OPS\n  body: none\n  auth: none\n}\n`
  const { parseBrunoManifest } = await import('../server/services/bruno/parser')
  const parsed = await parseBrunoManifest({collectionId: 'x', mode: 'create', files: [{path: 'request.bru', content: source}]}, VALUES, SECRETS)
  assert.ok(parsed.issues.some(issue => issue.code === 'UNSUPPORTED_VARIABLE'), JSON.stringify(parsed.issues))
})

test('path params round-trip separately from query params', async () => {
  const input = model({
    url: 'https://example.com/users/:id',
    params: [
      {name: 'id', value: '42', enabled: true, type: 'path'},
      {name: 'q', value: '{{NAME}}', enabled: true},
    ],
  })
  const result = await roundTrip(input)
  assert.deepEqual(result.model.params.map(row => row.name).sort(), input.params.map(row => row.name).sort())
  assert.equal(result.model.params.find(row => row.name === 'id')!.type, 'path')
  assert.equal(result.model.params.find(row => row.name === 'q')!.type, undefined)
  assert.equal(result.model.url, 'https://example.com/users/:id')
  assert.match(result.source, /params:path \{\n  id: 42/)
  assert.match(result.source, /params:query \{\n  q: \{\{NAME\}\}/)
  const url = result.source.split('\n').find(line => line.trim().startsWith('url:'))!
  assert.equal((url.match(/\?/g) || []).length, 1, url)
  assert.ok(url.includes('q={{NAME}}'), url)
  assert.ok(!url.includes('42'), 'path params stay in their own block')
})

test('path param values are substituted into the URL before execution', async () => {
  const { parseBrunoManifest } = await import('../server/services/bruno/parser')
  const source = `meta {
  name: Path params
  type: http
}

get {
  url: https://example.com/users/:id?view=full
  body: none
  auth: none
}

params:query {
  view: full
}

params:path {
  id: {{NAME}}
  ~off: ignored
}
`
  const parsed = await parseBrunoManifest({collectionId: 'x', mode: 'create', files: [{path: 'request.bru', content: source}]}, VALUES, SECRETS)
  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.requests[0]!.config.url, 'https://example.com/users/{{NAME}}')
  assert.deepEqual(parsed.requests[0]!.config.queryParams, [{name: 'view', value: 'full'}])
  assert.ok(!JSON.stringify(parsed.requests[0]!.config).includes('off'))
})

test('unsupported path param names fail closed', async () => {
  const { parseBrunoManifest } = await import('../server/services/bruno/parser')
  const source = `meta {\n  name: Bad path\n  type: http\n}\nget {\n  url: https://example.com/users/:id\n  body: none\n  auth: none\n}\nparams:path {\n  1bad: x\n}\n`
  const parsed = await parseBrunoManifest({collectionId: 'x', mode: 'create', files: [{path: 'request.bru', content: source}]}, VALUES, SECRETS)
  assert.ok(parsed.issues.some(issue => issue.code === 'UNSUPPORTED_PARAMETER'), JSON.stringify(parsed.issues))
})

test('query values with reserved characters are encoded without encoding {{variables}}', async () => {
  const input = model({
    url: 'https://example.com/search#results',
    params: [
      {name: 'q a', value: 'coffee & tea', enabled: true},
      {name: 'token', value: '{{TOKEN}}', enabled: true},
      {name: 'mixed', value: 'prefix-{{NAME}}-suffix', enabled: true},
      {name: 'unicode', value: '東京', enabled: true},
    ],
  })
  const result = await roundTrip(input)
  const url = result.source.split('\n').find(line => line.trim().startsWith('url:'))!
  assert.ok(url.includes('q%20a=coffee%20%26%20tea'), url)
  assert.ok(url.includes('token={{TOKEN}}'), url)
  assert.ok(url.includes('mixed=prefix-{{NAME}}-suffix'), url)
  assert.ok(url.includes('unicode=%E6%9D%B1%E4%BA%AC'), url)
  assert.deepEqual(result.model.params, input.params, 'params block keeps the original raw values')
})

test('docs block round-trips verbatim and stays out of the request configuration', async () => {
  const docs = '# Users endpoint\nReturns {{NAME}} with status 200.\n\n- no auth required'
  const input = model({docs})
  const result = await roundTrip(input)
  assert.equal(result.model.docs, docs)
  assert.match(result.source, /docs \{\n  # Users endpoint/)
  assert.match(result.source, /\{\{NAME\}\}/)
})

test('ignored script/tests/settings blocks are preserved verbatim through the UI model', async () => {
  const { sourceToModel, modelToSource } = await import('../server/services/bruno/request-editor')
  const source = `meta {
  name: Preserve
  type: http
}

get {
  url: https://example.com/health
  body: none
  auth: none
}

assert {
  res.status: eq 200
}

script:pre-request {
  req.setHeader('X-Ignored', '1');
}

tests {
  test('ignored', () => {});
}

vars:post-response {
  saved: value
}

settings {
  encodeUrl: true
}
`
  const parsed = await sourceToModel(source, VALUES, SECRETS)
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(parsed.model!.ignoredBlocks, ['script', 'tests', 'post-response vars'])
  assert.equal(parsed.model!.ignoredSources!.length, 4)

  const produced = await modelToSource(parsed.model!, VALUES, SECRETS)
  assert.deepEqual(produced.issues, [])
  assert.match(produced.source!, /script:pre-request \{\n  req\.setHeader\('X-Ignored', '1'\);/)
  assert.match(produced.source!, /tests \{\n  test\('ignored'/)
  assert.match(produced.source!, /vars:post-response \{\n  saved: value/)
  assert.match(produced.source!, /settings \{\n  encodeUrl: true/)
})

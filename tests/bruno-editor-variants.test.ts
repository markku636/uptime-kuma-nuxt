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
    { body: {mode: 'json', content: '{"count":{{COUNT}},"name":"{{NAME}}"}'}, expected: '"name":"{{NAME}}"' },
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
  for (const operator of ['matches', 'isJson', 'between', 'startsWith']) {
    const result = await modelToSource(model({assertions: [{expression: 'res.body.name', operator, value: '"x"', enabled: true}]}), VALUES, SECRETS)
    assert.equal(result.source, null, operator)
    assert.ok(result.issues.some(issue => issue.code === 'UNSUPPORTED_ASSERTION'), `${operator}: ${JSON.stringify(result.issues)}`)
  }
  const unknown = await modelToSource(model({assertions: [{expression: 'res.foobar', operator: 'eq', value: '1', enabled: true}]}), VALUES, SECRETS)
  assert.equal(unknown.source, null)
  assert.ok(unknown.issues.some(issue => issue.code === 'UNSUPPORTED_ASSERTION'))
})

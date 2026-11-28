import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractRules, validateExtractionRules } from '../server/services/bruno/test-definition'
import { extractTestVariables } from '../server/services/bruno/test-variables'

const request = (vars: string) => `meta {\n  name: Step\n  type: http\n  seq: 1\n}\n\npost {\n  url: http://127.0.0.1:9/login\n  body: none\n  auth: none\n}\n\nvars:post-response {\n${vars}\n}\n`

test('declarative extraction accepts only the safe Bruno subset', () => {
  const rules = extractRules(request([
    'token: res.body.data.token',
    'id: res.body.items[0].id',
    'status: res.status',
    'elapsed: res.responseTime',
    'requestId: res.headers.x-request-id'
  ].join('\n')))
  assert.deepEqual(rules.map(rule => rule.name), ['token', 'id', 'status', 'elapsed', 'requestId'])
  assert.equal(rules[0]!.source, 'json')
  assert.equal(rules[2]!.source, 'status')
  assert.equal(rules[4]!.path, 'x-request-id')
})

test('script-style and unsafe extraction expressions are rejected', () => {
  for (const value of ['bru.setVar("token", res.getBody().token)', 'res.body.__proto__.x', 'process.env.TOKEN', 'token + 1']) {
    assert.throws(() => extractRules(request(`token: ${value}`)), /UNSUPPORTED_EXTRACTION/)
  }
  assert.throws(() => extractRules(request('bad-name: res.status')), /INVALID_EXTRACTION_NAME/)
})

test('runtime extraction reads nested JSON and headers without persisting values', () => {
  const rules = validateExtractionRules([
    { name: 'token', source: 'json', path: '$.data.token' },
    { name: 'missing', source: 'json', path: '$.nope' },
    { name: 'status', source: 'status' },
    { name: 'requestId', source: 'header', path: 'X-Request-Id' },
  ])
  const values = extractTestVariables(rules, {
    status: 201, headers: { 'x-request-id': 'abc' }, body: JSON.stringify({ data: { token: 'secret-value' } }), elapsed: 42,
  })
  assert.deepEqual(values, { token: 'secret-value', missing: null, status: '201', requestId: 'abc' })
})

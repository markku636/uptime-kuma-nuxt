import {test} from 'node:test'
import assert from 'node:assert/strict'
import {monitorToBru, buildBrunoCollection} from '../server/services/bruno/collection-export'
import {BrunoExportError,exportBrunoMonitors} from '../server/services/bruno/exporter'

const source = `meta {
  name: Export me
  type: http
}

get {
  url: {{ORIGIN}}/health
  body: none
  auth: none
}

assert {
  res.status: eq {{EXPECTED}}
}
`
const stored = {
  id: 41, type: 'bruno', name: 'Export me', body: source,
  workspaceId: 1, environmentId: 2,
  requestSecrets: null,
}

const mockSecrets = () => {
  const names = new Set<string>()
  return {names, protect: (value: string, _name: string, field: string) => {
    if (!value || /\{\{/.test(value)) return value
    const name = `secret_${field}`
    names.add(name)
    return `{{${name}}}`
  }} as any
}

test('Bruno monitors export their stored .bru request', () => {
  const result = monitorToBru(stored, 1, mockSecrets())
  assert.match(result, /get \{/ )
  assert.match(result, /url: \{\{ORIGIN\}\}\/health/)
  assert.match(result, /res\.status: eq \{\{EXPECTED\}\}/)
})

test('Bruno monitors are included in collection exports', () => {
  const result = buildBrunoCollection({
    collectionName: 'Demo', monitors: [stored], groups: [], rootGroupId: null,
    environment: {name: 'default', variables: {}, secretNames: []},
  })
  const file = result.files.find(file => file.path.endsWith('.bru') && file.path !== 'bruno.json')!
  assert.match(file.content, /res\.status: eq \{\{EXPECTED\}\}/)
  assert.match(file.content, /url: \{\{ORIGIN\}\}\/health/)
  assert.equal(result.exported, 1)
})

test('an empty Bruno body is rejected with a safe export code', () => {
  assert.throws(() => monitorToBru({...stored, body: ''}, 1, mockSecrets()), BrunoExportError)
})

test('Bruno export replaces literal credentials with secret placeholders', () => {
  const credentialSource = `meta {
  name: Secret export
  type: http
}

post {
  url: https://example.com/login
  body: none
  auth: bearer
}

headers {
  X-Api-Key: literal-api-key
}

auth:bearer {
  token: literal-bearer-token
}
`
  const output = monitorToBru({...stored, name: 'Secret export', body: credentialSource}, 1, mockSecrets())
  assert.ok(!output.includes('literal-bearer-token'))
  assert.ok(!output.includes('literal-api-key'))
  assert.match(output, /token: \{\{secret_auth_bearer_token\}\}/)
  assert.match(output, /X-Api-Key: \{\{secret_header_0\}\}/)
  assert.match(output, /X-Api-Key: \{\{secret_header_0\}\}/)
})

test('redacted manifest export includes Bruno monitors with placeholders', async () => {
  const { exportBrunoMonitors } = await import('../server/services/bruno/exporter')
  const source = `meta {
  name: Redacted
  type: http
}

post {
  url: https://example.com/login
  body: none
  auth: bearer
}

auth:bearer {
  token: literal-secret
}
`
  const result = exportBrunoMonitors([{...stored, name: 'Redacted', body: source}], 'demo')
  const file = result.files.find(file => file.path.endsWith('.bru') && file.path !== 'bruno.json' && !file.path.startsWith('environments/'))!
  assert.ok(file, 'a Bruno request file is exported')
  assert.ok(!file.content.includes('literal-secret'))
  assert.ok(!file.content.includes('https://example.com/login'))
  assert.ok(result.secretNames.length >= 2)
  assert.ok(result.files.some(file => file.path === 'environments/configure.bru'))
})

test('redaction covers form bodies, scripts, docs and assertion values', () => {
  const source = `meta {
  name: Wide redaction
  type: http
}

post {
  url: {{ORIGIN}}/login
  body: formUrlEncoded
  auth: none
}

body:form-urlencoded {
  password: LITERAL_FORM_PASS
}

assert {
  res.body.token: eq LITERAL_ASSERT_SECRET
}

docs {
  LITERAL_DOC_SECRET
}

script:pre-request {
  req.setHeader('Authorization', 'Bearer LITERAL_SCRIPT_TOKEN');
}
`
  const result = exportBrunoMonitors([{...stored, name: 'Wide redaction', body: source}], 'demo')
  const file = result.files.find(file => file.path.endsWith('.bru') && !file.path.startsWith('environments/') && file.path !== 'bruno.json')!
  for (const literal of ['LITERAL_FORM_PASS', 'LITERAL_ASSERT_SECRET', 'LITERAL_DOC_SECRET', 'LITERAL_SCRIPT_TOKEN']) {
    assert.ok(!file.content.includes(literal), `${literal} leaked`)
  }
  assert.equal(new Set(result.secretNames).size, result.secretNames.length, 'secret names must be unique')
})

test('apikey auth credentials are redacted like basic/bearer', () => {
  const source = `meta {
  name: Api key
  type: http
}

get {
  url: {{ORIGIN}}
  body: none
  auth: apikey
}

auth:apikey {
  key: X-Api-Key
  value: LITERAL_API_KEY
  placement: header
}
`
  const output = monitorToBru({...stored, name: 'Api key', body: source}, 1, mockSecrets())
  assert.ok(!output.includes('LITERAL_API_KEY'))
  assert.match(output, /\{\{secret_auth_apikey_value\}\}/)
  assert.match(output, /placement: header/)
})

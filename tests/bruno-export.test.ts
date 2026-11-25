import {test} from 'node:test'
import assert from 'node:assert/strict'
import {monitorToBru, buildBrunoCollection} from '../server/services/bruno/collection-export'
import {BrunoExportError} from '../server/services/bruno/exporter'

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
  res.status: eq 200
}
`
const stored = {
  id: 41, type: 'bruno', name: 'Export me', body: source,
  workspaceId: 1, environmentId: 2,
  requestSecrets: null,
}

test('Bruno monitors export their stored .bru request', () => {
  const result = monitorToBru(stored, 1, {names: new Set<string>()} as any)
  assert.match(result, /get \{/ )
  assert.match(result, /url: \{\{ORIGIN\}\}\/health/)
  assert.match(result, /res\.status: eq 200/)
})

test('Bruno monitors are included in collection exports', () => {
  const result = buildBrunoCollection({
    collectionName: 'Demo', monitors: [stored], groups: [], rootGroupId: null,
    environment: {name: 'default', variables: {}, secretNames: []},
  })
  const file = result.files.find(file => file.path.endsWith('.bru') && file.path !== 'bruno.json')!
  assert.match(file.content, /res\.status: eq 200/)
  assert.match(file.content, /url: \{\{ORIGIN\}\}\/health/)
  assert.equal(result.exported, 1)
})

test('an empty Bruno body is rejected with a safe export code', () => {
  assert.throws(() => monitorToBru({...stored, body: ''}, 1, {names: new Set<string>()} as any), BrunoExportError)
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
  const names: string[] = []
  const secrets = {names: new Set<string>(), protect: (value: string, _name: string, field: string) => {
    if (!value || /\{\{/.test(value)) return value
    const name = `secret_${field}`
    names.push(name); (secrets.names as Set<string>).add(name)
    return `{{${name}}}`
  }} as any
  const output = monitorToBru({...stored, name: 'Secret export', body: credentialSource}, 1, secrets)
  assert.ok(!output.includes('literal-bearer-token'))
  assert.ok(!output.includes('literal-api-key'))
  assert.match(output, /token: \{\{secret_token\}\}/)
  assert.match(output, /X-Api-Key: \{\{secret_x_api_key\}\}/)
  assert.ok(names.includes('secret_token'))
  assert.ok(names.includes('secret_x_api_key'))
})

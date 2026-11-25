import {test} from 'node:test'
import assert from 'node:assert/strict'
import {monitorToBru, buildBrunoCollection} from '../server/services/bruno/collection-export'
import {BrunoExportError} from '../server/services/bruno/exporter'

const source = `meta {
  name: Export me
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
`
const stored = {
  id: 41, type: 'bruno', name: 'Export me', body: source,
  workspaceId: 1, environmentId: 2,
  requestSecrets: null,
}

test('Bruno monitors export their stored .bru verbatim', () => {
  const result = monitorToBru(stored, 1, {} as any)
  assert.equal(result, source)
})

test('Bruno monitors are included in collection exports', () => {
  const result = buildBrunoCollection({
    collectionName: 'Demo', monitors: [stored], groups: [], rootGroupId: null,
    environment: {name: 'default', variables: {}, secretNames: []},
  })
  const file = result.files.find(file => file.path.endsWith('.bru') && file.path !== 'bruno.json')!
  assert.equal(file.content, source)
  assert.equal(result.exported, 1)
})

test('an empty Bruno body is rejected with a safe export code', () => {
  assert.throws(() => monitorToBru({...stored, body: ''}, 1, {} as any), BrunoExportError)
})

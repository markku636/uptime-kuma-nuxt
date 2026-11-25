import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sourceToModel, modelToSource} from '../server/services/bruno/request-editor'
import type {BrunoRequestModel} from '../shared/types/bruno'

const base = (): BrunoRequestModel => ({
  name: 'Robust', method: 'GET', url: 'https://example.com', params: [], headers: [],
  auth: {mode: 'none'}, body: {mode: 'none', content: ''}, vars: [], assertions: [], ignoredBlocks: [],
})

async function expectSafeIssues(model: unknown) {
  const result = await modelToSource(model as BrunoRequestModel, {}, [])
  assert.equal(result.source, null)
  assert.ok(result.issues.length > 0)
  for (const issue of result.issues) {
    assert.match(issue.code, /^[A-Z_]+$/)
    assert.ok(issue.code.length < 64)
  }
}

test('malformed models never throw and only return safe issue codes', async () => {
  await expectSafeIssues(null)
  await expectSafeIssues([])
  await expectSafeIssues({...base(), name: 42})
  await expectSafeIssues({...base(), method: 'TRACE'})
  await expectSafeIssues({...base(), auth: {mode: 'digest'}})
  await expectSafeIssues({...base(), body: {mode: 'xml', content: '<x/>'}})
  await expectSafeIssues({...base(), params: [{name: 'a', value: 'b', enabled: 'yes'}]})
  await expectSafeIssues({...base(), headers: [{name: 'X\nBad', value: 'v', enabled: true}]})
  await expectSafeIssues({...base(), vars: [{name: '__proto__', value: 'x', enabled: true}]})
  await expectSafeIssues({...base(), assertions: [{expression: 'res.status', operator: 'eq', value: '200\nnext', enabled: true}]})
  await expectSafeIssues({...base(), docs: 'x'.repeat(40000)})
  await expectSafeIssues({...base(), ignoredSources: ['script { evil() }']})
  await expectSafeIssues({...base(), url: 'javascript:alert(1)'})
})

test('malformed sources return safe issues without leaking parser exception text', async () => {
  const sources = [
    'x'.repeat(140000),
    'get {\n  url: not-a-url\n}',
    'get {\n  url: https://example.com\n}\nget {\n  url: https://example.org\n}',
    'get {\n  url: https://example.com/{{process.env.SECRET_SENTINEL}}\n}',
    'get {\n  url: https://example.com\n}\nweird:block {\n  x: 1\n}',
  ]
  for (const source of sources) {
    const result = await sourceToModel(source, {SECRET_SENTINEL: 'TOP_SECRET_VALUE'}, ['SECRET_SENTINEL'])
    assert.equal(result.model, null)
    assert.ok(result.issues.length > 0)
    assert.ok(!JSON.stringify(result.issues).includes('TOP_SECRET_VALUE'))
    for (const issue of result.issues) assert.match(issue.code, /^[A-Z_]+$/)
  }
})

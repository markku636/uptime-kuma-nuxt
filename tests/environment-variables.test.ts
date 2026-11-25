import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidVariableName, useEnvironmentVariables, validateVariableMap } from '../composables/useEnvironmentVariables'

test('isValidVariableName matches the Settings key/value editor rule', () => {
  for (const name of ['NAME', '_private', 'api.url', 'with-dash', 'A'.repeat(100)]) {
    assert.equal(isValidVariableName(name), true, name)
  }
  for (const name of ['', '1name', 'has space', 'a'.repeat(101), 'name/slash', '{{name}}']) {
    assert.equal(isValidVariableName(name), false, name)
  }
})

test('validateVariableMap requires a plain object of strings and enforces the 200-key limit', () => {
  assert.deepEqual({ ...validateVariableMap({ A: '1', b_c: 'two' }) }, { A: '1', b_c: 'two' })
  for (const value of [null, 'text', [], 42]) {
    assert.throws(() => validateVariableMap(value), /Variables must be a JSON object of strings/)
  }
  assert.throws(() => validateVariableMap({ A: 1 }), /Variables must be a JSON object of strings/)
  assert.throws(() => validateVariableMap({ 'bad name': 'x' }), /Invalid variable name: bad name/)
  assert.throws(() => validateVariableMap(Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`K${i}`, 'v']))), /At most 200 variables/)
  // Raw JSON mode keeps the historical shape-only check.
  assert.deepEqual({ ...validateVariableMap({ 'bad name': 'x' }, { checkNames: false }) }, { 'bad name': 'x' })
})

test('preview masks secret values and reports unknown names', () => {
  const { preview } = useEnvironmentVariables()
  assert.deepEqual(
    preview('{{baseUrl}}/health?token={{apiKey}}&x={{missing}}', {
      id: 1, name: 'default',
      variables: { baseUrl: 'https://example.com', apiKey: 'SUPER_SECRET' },
      secretNames: ['apiKey'],
    }),
    { preview: 'https://example.com/health?token=••••••&x={{missing}}', missing: ['missing'] },
  )
  assert.deepEqual(preview('', null), { preview: '', missing: [] })
})

test('load ignores stale responses and leaves the newest environment list in place', async () => {
  const original = (globalThis as any).$fetch
  const pending: Array<(value: any) => void> = []
  ;(globalThis as any).$fetch = (_url: string) => new Promise(resolve => pending.push(resolve))
  try {
    const state = useEnvironmentVariables()
    const first = state.load(1)
    const second = state.load(2)
    assert.equal(pending.length, 2)
    pending[1]!({ data: [{ id: 2, name: 'newer', variables: {}, secretNames: [] }] })
    await second
    pending[0]!({ data: [{ id: 1, name: 'older', variables: {}, secretNames: [] }] })
    await first
    assert.deepEqual(state.environments.value.map(item => item.name), ['newer'])
    assert.equal(state.selected(2).value?.name, 'newer')
    assert.equal(state.loading.value, false)
  } finally { (globalThis as any).$fetch = original }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAssertions, evaluateRule } from '../server/utils/assertions'
import type { AssertionRule } from '../shared/types/assertions'

const rule = (operator: string, expected?: unknown, source: AssertionRule['source'] = 'json'): AssertionRule => ({
  id: `r-${operator}`, source, path: source === 'json' ? '$.value' : undefined,
  operator: operator as AssertionRule['operator'], ...(expected === undefined ? {} : {expected: expected as never}),
})
const check = (operator: string, exists: boolean, value: unknown, expected?: unknown) =>
  evaluateRule(rule(operator, expected, 'json'), exists, value)
const response = {status: 200, elapsed: 12, headers: {'x-mode': 'ready'}, body: JSON.stringify({value: 'alpha'})}

test('list membership operators evaluate deep-equal values', () => {
  assert.equal(check('in', true, 'alpha', ['alpha', 'beta']).passed, true)
  assert.equal(check('in', true, 'gamma', ['alpha', 'beta']).passed, false)
  assert.equal(check('notIn', true, 'gamma', ['alpha', 'beta']).passed, true)
  assert.equal(check('in', true, {id: 2}, [{id: 1}, {id: 2}]).passed, true)
  assert.equal(check('in', false, undefined, ['alpha']).passed, false)
})

test('prefix, suffix and length operators respect value types', () => {
  assert.equal(check('startsWith', true, 'alphabet', 'alpha').passed, true)
  assert.equal(check('endsWith', true, 'alphabet', 'bet').passed, true)
  assert.equal(check('startsWith', true, 12, 'a').passed, false)
  assert.equal(check('length', true, 'alpha', 5).passed, true)
  assert.equal(check('length', true, [1, 2, 3], 3).passed, true)
  assert.equal(check('length', true, 12, 2).passed, false)
})

test('type predicates never throw and report type mismatches', () => {
  assert.equal(check('isJson', true, '{"a":1}').passed, true)
  assert.equal(check('isJson', true, 'not json').passed, false)
  assert.equal(check('isNumber', true, 5).passed, true)
  assert.equal(check('isNumber', true, Number.NaN).passed, false)
  assert.equal(check('isString', true, 'x').passed, true)
  assert.equal(check('isBoolean', true, false).passed, true)
  assert.equal(check('isArray', true, []).passed, true)
  assert.equal(check('isArray', true, {}).passed, false)
  assert.equal(check('isString', false, undefined).passed, false)
})

test('emptiness predicates handle strings, arrays and objects', () => {
  assert.equal(check('isEmpty', true, '').passed, true)
  assert.equal(check('isEmpty', true, []).passed, true)
  assert.equal(check('isEmpty', true, {}).passed, true)
  assert.equal(check('isNotEmpty', true, 'x').passed, true)
  assert.equal(check('isNotEmpty', true, []).passed, false)
  assert.equal(check('isEmpty', false, undefined).passed, false)
})

test('evaluateAssertions accepts the new operators in a valid rule set', () => {
  const set = {
    version: 1 as const, mode: 'all' as const,
    rules: [
      rule('in', ['alpha', 'beta']),
      rule('startsWith', 'alp'),
      rule('length', 5),
      rule('isString', undefined),
    ],
  }
  const result = evaluateAssertions(set, response)
  assert.equal(result.error, undefined)
  assert.deepEqual(result.rules.map(row => row.passed), [true, true, true, true])
  assert.equal(result.passed, true)
})

test('invalid expected types are rejected instead of crashing the checker', () => {
  assert.equal(evaluateAssertions({version: 1, mode: 'all', rules: [rule('in', 'alpha')]}, response).error, 'CONFIG_ERROR')
  assert.equal(evaluateAssertions({version: 1, mode: 'all', rules: [rule('length', '2')]}, response).error, 'CONFIG_ERROR')
  assert.equal(evaluateAssertions({version: 1, mode: 'all', rules: [rule('startsWith', 2)]}, response).error, 'CONFIG_ERROR')
})

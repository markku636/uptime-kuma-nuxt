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

test('between and truthiness predicates evaluate without throwing', () => {
  assert.equal(check('between', true, 250, [200, 299]).passed, true)
  assert.equal(check('between', true, 300, [200, 299]).passed, false)
  assert.equal(check('between', true, '250', [200, 299]).passed, false)
  assert.equal(check('isDefined', true, 0).passed, true)
  assert.equal(check('isDefined', false, undefined).passed, false)
  assert.equal(check('isUndefined', false, undefined).passed, true)
  assert.equal(check('isTruthy', true, 1).passed, true)
  assert.equal(check('isTruthy', true, 0).passed, false)
  assert.equal(check('isFalsy', true, '').passed, true)
  assert.equal(check('isFalsy', false, undefined).passed, false)
})

test('Bruno between token with two numbers is parsed into a bounded range', async () => {
  const { parseBrunoManifest } = await import('../server/services/bruno/parser')
  const source = `meta {\n  name: Between\n  type: http\n}\nget {\n  url: https://example.com/health\n  body: none\n  auth: none\n}\nassert {\n  res.status: between 200 299\n}\n`
  const parsed = await parseBrunoManifest({collectionId: 'x', mode: 'create', files: [{path: 'request.bru', content: source}]}, {}, [])
  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(parsed.requests[0]!.config.assertions.rules[0].expected, [200, 299])
})

test('safe pattern matcher supports the bounded regex subset', async () => {
  const { safePatternMatch } = await import('../server/utils/safe-pattern')
  assert.equal(safePatternMatch('ok.123', '^ok\\..*'), true)
  assert.equal(safePatternMatch('OK.123', '^ok\\..*'), false)
  assert.equal(safePatternMatch('abc123', '[a-z]+[0-9]+'), true)
  assert.equal(safePatternMatch('hello world', 'world$'), true)
  assert.equal(safePatternMatch('nomatch', '^ok'), false)
  assert.equal(safePatternMatch('anything', '(a|aa)+$'), null, 'groups/alternation are rejected')
  assert.equal(safePatternMatch('x', 'a{100}{100}'), null)
})

test('matches and notMatches evaluate through the safe matcher and fail closed on bad patterns', () => {
  assert.equal(check('matches', true, 'ok.123', '^ok\\..*').passed, true)
  assert.equal(check('notMatches', true, 'ok.123', '^[0-9]+$').passed, true)
  assert.equal(check('matches', true, '123', '^[0-9]+$').passed, true)
  assert.equal(check('matches', true, 'abc', '(a|aa)+$').passed, false)
  assert.equal(check('matches', true, 123, '^ok').passed, false)
  assert.equal(check('matches', false, undefined, '^ok').passed, false)
})

test('trial-only actual values are capped and absent from scheduled evaluations', async () => {
  const { evaluateAssertions } = await import('../server/utils/assertions')
  const set = {version: 1 as const, mode: 'all' as const, rules: [rule('equals', 'alpha')]}
  const response = {status: 200, elapsed: 5, headers: {}, body: JSON.stringify({value: 'alpha'})}
  const scheduled = evaluateAssertions(set, response)
  assert.equal(scheduled.rules[0]!.actual, undefined)

  const trial = evaluateAssertions(set, response, true)
  assert.equal(trial.rules[0]!.actual, 'alpha')

  const large = evaluateAssertions({...set, rules: [rule('isString', undefined)]}, {...response, body: JSON.stringify({value: 'x'.repeat(5000)})}, true)
  assert.equal(String(large.rules[0]!.actual).length, 513)
})

test('50 assertions with safe regexes evaluate well within the trial budget', async () => {
  const { evaluateAssertions } = await import('../server/utils/assertions')
  const rules = Array.from({length: 50}, (_, index) => {
    const operator = index % 5 === 0 ? 'matches' : index % 5 === 1 ? 'contains' : index % 5 === 2 ? 'equals' : index % 5 === 3 ? 'isString' : 'notMatches'
    const expected = operator === 'matches' || operator === 'notMatches' ? '^ok.*'
      : operator === 'contains' ? 'ok' : operator === 'equals' ? 'alpha' : undefined
    return {id: `perf-${index}`, source: 'json', path: '$.value', operator,
      ...(expected === undefined ? {} : {expected})} as AssertionRule
  })
  const response = {status: 200, elapsed: 12, headers: {}, body: JSON.stringify({value: 'ok-alpha-' + 'x'.repeat(60000)})}
  const started = performance.now()
  const result = evaluateAssertions({version: 1, mode: 'all', rules}, response, true)
  const elapsed = performance.now() - started
  assert.equal(result.error, undefined)
  assert.equal(result.rules.length, 50)
  assert.ok(elapsed < 2000, `50 assertions took ${Math.round(elapsed)} ms`)
})

test('every supported operator exports back to a parseable .bru assertion', async () => {
  const { assertionPair } = await import('../server/services/bruno/exporter')
  const { parseBrunoManifest } = await import('../server/services/bruno/parser')
  const cases: Array<{operator: AssertionRule['operator']; expected?: unknown}> = [
    {operator: 'equals', expected: 200}, {operator: 'notEquals', expected: 404},
    {operator: 'contains', expected: 'ok'}, {operator: 'notContains', expected: 'bad'},
    {operator: 'gt', expected: 1}, {operator: 'gte', expected: 1}, {operator: 'lt', expected: 5}, {operator: 'lte', expected: 5},
    {operator: 'in', expected: [200, 201]}, {operator: 'notIn', expected: [500]},
    {operator: 'matches', expected: '^ok.*'}, {operator: 'notMatches', expected: '^[0-9]+$'},
    {operator: 'startsWith', expected: 'ok'}, {operator: 'endsWith', expected: 'done'},
    {operator: 'length', expected: 2}, {operator: 'between', expected: [200, 299]},
    ...(['exists', 'notExists', 'isNull', 'isNotNull', 'isEmpty', 'isNotEmpty', 'isJson', 'isNumber', 'isString', 'isBoolean', 'isArray', 'isDefined', 'isUndefined', 'isTruthy', 'isFalsy'] as AssertionRule['operator'][]).map(operator => ({operator})),
  ]
  for (const item of cases) {
    const numeric = new Set(['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'between'])
    const ruleSource: AssertionRule['source'] = numeric.has(item.operator) ? 'status' : 'json'
    const rule: AssertionRule = {id: 'r', source: ruleSource, ...(ruleSource === 'json' ? {path: '$.value'} : {}), operator: item.operator, ...(item.expected === undefined ? {} : {expected: item.expected as never})}
    const pair = assertionPair(rule)
    assert.ok(!pair.value.includes('undefined'), JSON.stringify(pair))
    const source = `meta {\n  name: Export\n  type: http\n}\nget {\n  url: https://example.com\n  body: none\n  auth: none\n}\nassert {\n  ${pair.name}: ${pair.value}\n}\n`
    const parsed = await parseBrunoManifest({collectionId: 'x', mode: 'create', files: [{path: 'request.bru', content: source}]}, {}, [])
    assert.deepEqual(parsed.issues, [], `${item.operator}: ${JSON.stringify(pair)}`)
    assert.equal(parsed.requests[0]!.config.assertions.rules[0]!.operator, item.operator)
  }
})

test('64 unbounded tokens on a 4 KB value stay fast after the linear rewrite', async () => {
  const { safePatternMatch } = await import('../server/utils/safe-pattern')
  const started = performance.now()
  assert.equal(safePatternMatch('x'.repeat(4096), '^' + '.*'.repeat(64)), true)
  assert.ok(performance.now() - started < 1000, 'safe pattern matcher must be linear-time')
})

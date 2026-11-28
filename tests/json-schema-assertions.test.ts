import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAssertions, assertionsSchema } from '../server/utils/assertions'
import { validateSchemaSubset, schemaNodeSchema } from '../server/utils/json-schema-subset'

const response = { status: 200, elapsed: 20, headers: {}, body: JSON.stringify({ id: 7, name: 'Shop', tags: ['a'], price: 12 }) }

test('jsonSchema assertion validates response payload against a bounded subset', () => {
  const set = {
    version: 1, mode: 'all', rules: [{
      id: 'shape', source: 'jsonSchema', operator: 'schemaValid',
      expected: { type: 'object', required: ['id', 'name'], properties: { id: { type: 'integer' }, name: { type: 'string', minLength: 2 }, price: { type: 'number', minimum: 0 } } },
    }],
  }
  const parsed = assertionsSchema.safeParse(set)
  assert.equal(parsed.success, true)
  const result = evaluateAssertions(set, response)
  assert.equal(result.error, undefined)
  assert.equal(result.passed, true)
})

test('jsonSchema assertion fails on type and missing required fields', () => {
  const set = { version: 1, mode: 'all', rules: [{
    id: 'shape', source: 'jsonSchema', operator: 'schemaValid',
    expected: { type: 'object', required: ['missing'], properties: { id: { type: 'string' } } },
  }] }
  const result = evaluateAssertions(set, response)
  assert.equal(result.passed, false)
  assert.equal(result.rules[0]?.passed, false)
})

test('unsupported schema keywords and wrong operators are rejected', () => {
  assert.equal(schemaNodeSchema.safeParse({ $ref: '#/definitions/x' }).success, false)
  const bad = assertionsSchema.safeParse({ version: 1, mode: 'all', rules: [{ id: 'x', source: 'jsonSchema', operator: 'equals', expected: {} }] })
  assert.equal(bad.success, false)
  assert.ok(validateSchemaSubset({ a: 1 }, { type: 'object', properties: { a: { type: 'integer' } } }).length === 0)
})

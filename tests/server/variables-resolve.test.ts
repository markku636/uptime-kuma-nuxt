import { describe, expect, it } from 'vitest'
import { applyVariables, placeholders, usesVariables, VARIABLE_NAME, variablesForWorkspace } from '../../server/services/variables/resolve'

describe('variablesForWorkspace', () => {
  const all = [
    { name: 'host', value: 'https://global', workspaceId: null },
    { name: 'token', value: 'g', workspaceId: null },
    { name: 'host', value: 'https://prod', workspaceId: 1 },
    { name: 'host', value: 'https://stage', workspaceId: 2 },
  ]

  it('lets the workspace override global values', () => {
    expect(variablesForWorkspace(all, 1)).toEqual({ host: 'https://prod', token: 'g' })
    expect(variablesForWorkspace(all, 2).host).toBe('https://stage')
  })

  it('uses only global values outside a workspace', () => {
    expect(variablesForWorkspace(all, null)).toEqual({ host: 'https://global', token: 'g' })
  })
})

describe('applyVariables', () => {
  const vars = { host: 'https://api.example.com', base: '{{host}}/v2', token: 's3cr3t', user: 'admin' }

  it('fills url, body, auth and headers (object or JSON string)', () => {
    const { monitor, missing } = applyVariables({
      url: '{{base}}/health',
      body: '{"t":"{{token}}"}',
      basicAuthUser: '{{user}}',
      headers: { Authorization: 'Bearer {{ token }}' },
      interval: 60,
    }, vars)
    expect(monitor).toEqual({
      url: 'https://api.example.com/v2/health',
      body: '{"t":"s3cr3t"}',
      basicAuthUser: 'admin',
      headers: { Authorization: 'Bearer s3cr3t' },
      interval: 60,
    })
    expect(missing).toEqual([])
    expect(applyVariables({ headers: '{"X-Key":"{{token}}"}' }, vars).monitor.headers).toBe('{"X-Key":"s3cr3t"}')
  })

  it('reports names without a value and leaves them in place', () => {
    const { monitor, missing } = applyVariables({ url: '{{host}}/{{nope}}', keyword: '{{other}}' }, vars)
    expect(monitor.url).toBe('https://api.example.com/{{nope}}')
    expect(missing.sort()).toEqual(['nope', 'other'])
  })

  it('does not touch the original monitor', () => {
    const original = { url: '{{host}}' }
    applyVariables(original, vars)
    expect(original.url).toBe('{{host}}')
  })
})

describe('helpers', () => {
  it('detects placeholders', () => {
    expect(usesVariables({ url: 'https://x' })).toBe(false)
    expect(usesVariables({ url: 'https://x', headers: { A: '{{a}}' } })).toBe(true)
    expect(usesVariables({ hostname: '{{db}}' })).toBe(true)
    expect(placeholders('{{a}} {{ b }} {{a}}')).toEqual(['a', 'b'])
  })

  it('validates names', () => {
    expect(VARIABLE_NAME.test('baseUrl')).toBe(true)
    expect(VARIABLE_NAME.test('process.env.API_KEY')).toBe(true)
    expect(VARIABLE_NAME.test('1bad')).toBe(false)
    expect(VARIABLE_NAME.test('has space')).toBe(false)
  })
})

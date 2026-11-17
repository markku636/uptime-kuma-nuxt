import { describe, expect, it } from 'vitest'
import { bodyText, parseHeaders, proxyUrl, splitNtlmUser } from '../../server/services/monitor/checkers/http-options'

describe('parseHeaders', () => {
  it('accepts objects and JSON strings', () => {
    expect(parseHeaders({ 'X-A': 'b', n: 1, skip: null })).toEqual({ 'X-A': 'b', n: '1' })
    expect(parseHeaders('{"Accept":"application/json"}')).toEqual({ Accept: 'application/json' })
  })

  it('ignores anything that is not a header object', () => {
    expect(parseHeaders('')).toEqual({})
    expect(parseHeaders('not json')).toEqual({})
    expect(parseHeaders('["a"]')).toEqual({})
    expect(parseHeaders(null)).toEqual({})
  })
})

describe('splitNtlmUser', () => {
  it('splits DOMAIN\\user', () => {
    expect(splitNtlmUser('CORP\\alice')).toEqual({ domain: 'CORP', username: 'alice' })
    expect(splitNtlmUser('alice')).toEqual({ domain: '', username: 'alice' })
    expect(splitNtlmUser('alice@corp.example')).toEqual({ domain: '', username: 'alice@corp.example' })
  })
})

describe('proxyUrl', () => {
  const base = { host: 'proxy.local', port: 3128, auth: false, username: null, password: null }

  it('builds http(s) proxy URLs with encoded credentials', () => {
    expect(proxyUrl({ ...base, protocol: 'http' })).toBe('http://proxy.local:3128')
    expect(proxyUrl({ ...base, protocol: 'HTTPS', auth: true, username: 'u@x', password: 'p:w' }))
      .toBe('https://u%40x:p%3Aw@proxy.local:3128')
  })

  it('ignores credentials unless auth is on, and rejects SOCKS', () => {
    expect(proxyUrl({ ...base, protocol: 'http', username: 'u', password: 'p' })).toBe('http://proxy.local:3128')
    expect(proxyUrl({ ...base, protocol: 'socks5' })).toBeNull()
  })
})

describe('bodyText', () => {
  it('turns any response body into text', () => {
    expect(bodyText('ok')).toBe('ok')
    expect(bodyText(Buffer.from('buf'))).toBe('buf')
    expect(bodyText({ a: 1 })).toBe('{"a":1}')
    expect(bodyText(undefined)).toBe('')
  })
})

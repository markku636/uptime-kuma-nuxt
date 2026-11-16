import { describe, expect, it } from 'vitest'
import { checkApiKey, extractApiKey, isApiKeyPath, isForbiddenForApiKey } from '../../server/services/auth/api-key'

describe('extractApiKey', () => {
  it('reads X-API-Key', () => {
    expect(extractApiKey({ xApiKey: 'uk_abc' })).toBe('uk_abc')
    expect(extractApiKey({ xApiKey: ['uk_abc', 'uk_def'] })).toBe('uk_abc')
  })

  it('reads Authorization: Bearer uk_ tokens only', () => {
    expect(extractApiKey({ authorization: 'Bearer uk_abc' })).toBe('uk_abc')
    expect(extractApiKey({ authorization: 'bearer   uk_abc' })).toBe('uk_abc')
    expect(extractApiKey({ authorization: 'Bearer some-jwt' })).toBeUndefined()
    expect(extractApiKey({ authorization: 'Basic dXNlcjpwYXNz' })).toBeUndefined()
  })

  it('prefers X-API-Key and ignores empty headers', () => {
    expect(extractApiKey({ xApiKey: 'uk_a', authorization: 'Bearer uk_b' })).toBe('uk_a')
    expect(extractApiKey({ xApiKey: '  ', authorization: 'Bearer uk_b' })).toBe('uk_b')
    expect(extractApiKey({})).toBeUndefined()
  })
})

describe('paths', () => {
  it('scopes keys to /api/v1', () => {
    expect(isApiKeyPath('/api/v1/monitors')).toBe(true)
    expect(isApiKeyPath('/api/v1/monitors?x=1')).toBe(true)
    expect(isApiKeyPath('/api/auth/profile')).toBe(false)
    expect(isApiKeyPath('/api/settings/general')).toBe(false)
  })

  it('forbids key management with a key', () => {
    expect(isForbiddenForApiKey('/api/v1/api-keys')).toBe(true)
    expect(isForbiddenForApiKey('/api/v1/api-keys/3')).toBe(true)
    expect(isForbiddenForApiKey('/api/v1/api-keys?x=1')).toBe(true)
    expect(isForbiddenForApiKey('/api/v1/api-keysx')).toBe(false)
    expect(isForbiddenForApiKey('/api/v1/monitors')).toBe(false)
  })
})

describe('checkApiKey', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const valid = { active: true, expires: null, user: { active: true } }

  it('accepts an active, unexpired key of an active user', () => {
    expect(checkApiKey(valid, now)).toEqual({ ok: true })
    expect(checkApiKey({ ...valid, expires: new Date('2026-06-02T00:00:00Z') }, now)).toEqual({ ok: true })
  })

  it('rejects unknown, disabled, expired and orphaned keys', () => {
    expect(checkApiKey(null, now).ok).toBe(false)
    expect(checkApiKey({ ...valid, active: false }, now).ok).toBe(false)
    expect(checkApiKey({ ...valid, expires: now }, now).ok).toBe(false)
    expect(checkApiKey({ ...valid, user: { active: false } }, now).ok).toBe(false)
    expect(checkApiKey({ ...valid, user: null }, now).ok).toBe(false)
  })
})

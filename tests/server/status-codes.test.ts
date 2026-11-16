import { describe, expect, it } from 'vitest'
import { isStatusAccepted, normalizeMonitorPayload, normalizeStatusCodes } from '../../server/services/monitor/status-codes'

describe('accepted status codes', () => {
  it('normalises arrays, JSON strings and comma lists', () => {
    expect(normalizeStatusCodes(['200-299', 404])).toEqual(['200-299', '404'])
    expect(normalizeStatusCodes('["200-299"]')).toEqual(['200-299'])
    expect(normalizeStatusCodes('200-299, 301 ,bad')).toEqual(['200-299', '301'])
    expect(normalizeStatusCodes(null)).toEqual([])
  })

  it('matches exact codes and ranges', () => {
    expect(isStatusAccepted(204, ['200-299'])).toBe(true)
    expect(isStatusAccepted(301, ['200-299'])).toBe(false)
    expect(isStatusAccepted(404, '["200-299","404"]')).toBe(true)
  })

  it('falls back to 2xx/3xx when nothing is configured', () => {
    expect(isStatusAccepted(302, [])).toBe(true)
    expect(isStatusAccepted(500, undefined)).toBe(false)
  })
})

describe('normalizeMonitorPayload', () => {
  it('accepts headers as JSON string and legacy basic auth keys', () => {
    expect(normalizeMonitorPayload({
      headers: '{"Accept":"application/json","X-N":1}',
      basic_auth_user: 'u',
      basic_auth_pass: 'p',
      acceptedStatuscodes: '200-299, 404',
    })).toEqual({
      headers: { Accept: 'application/json', 'X-N': '1' },
      basicAuthUser: 'u',
      basicAuthPass: 'p',
      acceptedStatuscodes: ['200-299', '404'],
    })
  })

  it('turns an empty header string into null', () => {
    expect(normalizeMonitorPayload({ headers: '  ' }).headers).toBeNull()
  })
})

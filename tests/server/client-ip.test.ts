import { describe, expect, it } from 'vitest'
import { clientIp, envTrustsProxy, isPrivateAddress } from '../../server/services/auth/client-ip'

describe('isPrivateAddress', () => {
  it('knows proxy-side ranges', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:10.1.2.3', '172.18.0.5', '192.168.1.9', '100.64.0.1', 'fd12:3456::1', 'fe80::1']) {
      expect(isPrivateAddress(a), a).toBe(true)
    }
    for (const a of ['8.8.8.8', '172.32.0.1', '203.0.113.7', '2001:db8::1', undefined, '']) {
      expect(isPrivateAddress(a), String(a)).toBe(false)
    }
  })
})

describe('clientIp', () => {
  const spoof = { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }

  it('ignores forwarded headers from a direct internet client', () => {
    expect(clientIp(spoof, '203.0.113.7', false)).toBe('203.0.113.7')
  })

  it('believes a proxy on a private address', () => {
    expect(clientIp({ 'x-real-ip': '198.51.100.2' }, '172.18.0.2', false)).toBe('198.51.100.2')
    // nginx appends the real peer: earlier hops are the client's own claims
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 198.51.100.2' }, '127.0.0.1', false)).toBe('198.51.100.2')
  })

  it('believes any peer when Trust Proxy is on', () => {
    expect(clientIp({ 'x-forwarded-for': '9.9.9.9, 198.51.100.3' }, '203.0.113.7', true)).toBe('198.51.100.3')
    expect(clientIp({}, '203.0.113.7', true)).toBe('203.0.113.7')
  })

  it('reads TRUST_PROXY', () => {
    expect(envTrustsProxy('true')).toBe(true)
    expect(envTrustsProxy('1')).toBe(true)
    expect(envTrustsProxy('no')).toBe(false)
    expect(envTrustsProxy(undefined)).toBe(false)
  })
})

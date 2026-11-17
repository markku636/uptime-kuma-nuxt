import { describe, expect, it } from 'vitest'
import { clientIp, envTrustsProxy, isLoopback } from '../../server/services/auth/client-ip'

describe('isLoopback', () => {
  it('only accepts this host', () => {
    for (const a of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1']) expect(isLoopback(a), a).toBe(true)
    for (const a of ['10.0.0.1', '172.17.0.1', '192.168.1.1', '8.8.8.8', undefined]) expect(isLoopback(a), String(a)).toBe(false)
  })
})

describe('clientIp', () => {
  const forged = { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }

  it('ignores forwarded headers from other peers unless the proxy is trusted', () => {
    expect(clientIp(forged, '203.0.113.7', false)).toBe('203.0.113.7')
    // Docker userland-proxy / slirp make outside clients look private: still not trusted
    expect(clientIp(forged, '172.17.0.1', false)).toBe('172.17.0.1')
  })

  it('uses the hop the proxy appended, never X-Real-IP', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 198.51.100.2', 'x-real-ip': '9.9.9.9' }, '127.0.0.1', false)).toBe('198.51.100.2')
    expect(clientIp({ 'x-real-ip': '9.9.9.9' }, '127.0.0.1', false)).toBe('127.0.0.1')
  })

  it('believes any peer when Trust Proxy is on', () => {
    expect(clientIp({ 'x-forwarded-for': '9.9.9.9, 198.51.100.3' }, '172.18.0.2', true)).toBe('198.51.100.3')
    expect(clientIp({}, '203.0.113.7', true)).toBe('203.0.113.7')
  })

  it('reads TRUST_PROXY', () => {
    expect(envTrustsProxy('true')).toBe(true)
    expect(envTrustsProxy('1')).toBe(true)
    expect(envTrustsProxy('no')).toBe(false)
    expect(envTrustsProxy(undefined)).toBe(false)
  })
})

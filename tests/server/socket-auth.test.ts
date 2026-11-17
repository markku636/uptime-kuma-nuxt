import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/prisma', () => ({ prisma: {} }))
const { isSameOrigin, readCookie } = await import('../../server/services/socket-auth')

describe('readCookie', () => {
  it('finds one cookie among several', () => {
    expect(readCookie('a=1; nuxt-session=Fe26.2**abc%3D; b=2', 'nuxt-session')).toBe('Fe26.2**abc=')
    expect(readCookie('nuxt-session-x=1', 'nuxt-session')).toBeNull()
    expect(readCookie(undefined, 'nuxt-session')).toBeNull()
  })
})

describe('isSameOrigin', () => {
  it('lets clients without an Origin through', () => {
    expect(isSameOrigin({ host: 'kuma.example' })).toBe(true)
  })

  it('accepts the same host, directly or behind a proxy', () => {
    expect(isSameOrigin({ origin: 'https://kuma.example', host: 'kuma.example' })).toBe(true)
    expect(isSameOrigin({ origin: 'https://kuma.example', host: 'app:3000', 'x-forwarded-host': 'kuma.example' })).toBe(true)
    expect(isSameOrigin({ origin: 'http://localhost:32420', host: 'localhost:32420' })).toBe(true)
  })

  it('rejects other sites and junk origins', () => {
    expect(isSameOrigin({ origin: 'https://evil.example', host: 'kuma.example' })).toBe(false)
    expect(isSameOrigin({ origin: 'http://localhost:9999', host: 'localhost:32420' })).toBe(false)
    expect(isSameOrigin({ origin: 'null', host: 'kuma.example' })).toBe(false)
  })
})

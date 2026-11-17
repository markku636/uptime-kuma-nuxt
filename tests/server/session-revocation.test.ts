import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/prisma', () => ({ prisma: {} }))
const { isRevoked } = await import('../../server/services/auth/session-revocation')

describe('isRevoked', () => {
  it('keeps sessions while nothing was revoked', () => {
    expect(isRevoked({ loggedInAt: 1 }, 0)).toBe(false)
    expect(isRevoked({}, 0)).toBe(false)
  })

  it('ends sessions that logged in before the cut-off', () => {
    expect(isRevoked({ loggedInAt: 999 }, 1000)).toBe(true)
    // Sessions from before loggedInAt existed count as old
    expect(isRevoked({}, 1000)).toBe(true)
  })

  it('keeps the session that did the revoking and later logins', () => {
    expect(isRevoked({ loggedInAt: 1000 }, 1000)).toBe(false)
    expect(isRevoked({ loggedInAt: 2000 }, 1000)).toBe(false)
  })

  it('never applies to API keys', () => {
    expect(isRevoked({ apiKeyId: 3 }, 1000)).toBe(false)
  })
})

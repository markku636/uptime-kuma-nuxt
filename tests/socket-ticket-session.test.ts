import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { signSocketTicket, verifySocketTicket } from '../server/utils/socket-ticket'

const secret = 'test-secret-at-least-32-bytes-long'
const identity = { userId: 1, sessionVersion: 0, workspaceId: 1, environmentId: 1 }

describe('socket ticket session binding', () => {
  it('carries the tracked session id through sign/verify', () => {
    const ticket = signSocketTicket({ ...identity, sessionId: 'sess_abc12345' }, secret)
    const parsed = verifySocketTicket(ticket, secret)
    assert.equal(parsed.sessionId, 'sess_abc12345')
    assert.equal(parsed.userId, 1)
  })

  it('allows tickets issued before session tracking', () => {
    const ticket = signSocketTicket(identity, secret)
    assert.equal(verifySocketTicket(ticket, secret).sessionId, undefined)
  })

  it('rejects a malformed session id', () => {
    const ticket = signSocketTicket({ ...identity, sessionId: '../../etc/passwd' }, secret)
    assert.throws(() => verifySocketTicket(ticket, secret), /Expired or invalid socket ticket/)
  })
})

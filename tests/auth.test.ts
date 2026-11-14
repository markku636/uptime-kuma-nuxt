import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signSocketTicket, verifySocketTicket } from '../server/utils/socket-ticket'

const secret = 'test-only-secret-with-at-least-32-characters'
test('socket ticket validates signature, TTL, identity and session version', () => {
  const ticket = signSocketTicket({ userId: 42, sessionVersion: 7, workspaceId: 1, environmentId: 1 }, secret, 100_000)
  assert.equal(verifySocketTicket(ticket, secret, 100_001).userId, 42)
  assert.equal(verifySocketTicket(ticket, secret, 100_001).sessionVersion, 7)
  assert.throws(() => verifySocketTicket(ticket, 'wrong secret', 100_001))
  assert.throws(() => verifySocketTicket(ticket, secret, 160_000))
  assert.throws(() => verifySocketTicket(ticket + '.extra', secret, 100_001))
  assert.throws(() => verifySocketTicket('1'.repeat(1025), secret))
  const [body, signature] = ticket.split('.')
  assert.throws(() => verifySocketTicket(`${body.slice(0, -1)}A.${signature}`, secret, 100_001))
})

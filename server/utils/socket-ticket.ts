import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export interface SocketTicket { userId: number; sessionVersion: number; workspaceId: number; environmentId: number; expiresAt: number; nonce: string }

export function signSocketTicket(identity: Pick<SocketTicket, 'userId' | 'sessionVersion' | 'workspaceId' | 'environmentId'>, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...identity, expiresAt: now + 60_000,
    nonce: randomBytes(16).toString('hex') } satisfies SocketTicket)).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}

export function verifySocketTicket(ticket: unknown, secret: string, now = Date.now()): SocketTicket {
  if (typeof ticket !== 'string' || ticket.length > 1024) throw new Error('Invalid socket ticket')
  const [payload, signature, extra] = ticket.split('.')
  if (!payload || !signature || extra) throw new Error('Invalid socket ticket')
  const expected = createHmac('sha256', secret).update(payload).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid socket ticket')
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SocketTicket
  if (!Number.isSafeInteger(parsed.userId) || parsed.userId <= 0 || !Number.isSafeInteger(parsed.sessionVersion)
    || !Number.isSafeInteger(parsed.workspaceId) || parsed.workspaceId <= 0
    || !Number.isSafeInteger(parsed.environmentId) || parsed.environmentId <= 0
    || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now || parsed.expiresAt > now + 60_000) {
    throw new Error('Expired or invalid socket ticket')
  }
  return parsed
}

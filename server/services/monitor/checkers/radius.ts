// server/services/monitor/checkers/radius.ts
// A RADIUS Access-Request (RFC 2865, PAP) and its reply. Pure packet code,
// tested against a local RADIUS responder in tests/server/radius.test.ts.
import { createHash, createHmac, randomBytes } from 'node:crypto'

export const RADIUS_CODES: Record<number, string> = {
  1: 'Access-Request',
  2: 'Access-Accept',
  3: 'Access-Reject',
  11: 'Access-Challenge',
}

const ATTR = {
  USER_NAME: 1,
  USER_PASSWORD: 2,
  NAS_IDENTIFIER: 32,
  CALLED_STATION_ID: 30,
  CALLING_STATION_ID: 31,
  MESSAGE_AUTHENTICATOR: 80,
} as const

const md5 = (...parts: Buffer[]) => createHash('md5').update(Buffer.concat(parts)).digest()

function attribute(type: number, value: Buffer): Buffer {
  if (value.length > 253) throw new Error('RADIUS attribute too long')
  return Buffer.concat([Buffer.from([type, value.length + 2]), value])
}

/** User-Password hiding (RFC 2865 §5.2) */
export function hidePassword(password: string, secret: string, authenticator: Buffer): Buffer {
  const raw = Buffer.from(password, 'utf8')
  if (raw.length > 128) throw new Error('RADIUS password too long')
  const padded = Buffer.alloc(Math.max(16, Math.ceil(raw.length / 16) * 16))
  raw.copy(padded)
  const out = Buffer.alloc(padded.length)
  let previous = authenticator
  for (let i = 0; i < padded.length; i += 16) {
    const b = md5(Buffer.from(secret, 'utf8'), previous)
    for (let j = 0; j < 16; j++) out[i + j] = padded[i + j] ^ b[j]
    previous = out.subarray(i, i + 16)
  }
  return out
}

export interface AccessRequest {
  username: string
  password: string
  secret: string
  calledStationId?: string | null
  callingStationId?: string | null
  identifier?: number
  authenticator?: Buffer
}

/** The packet, plus what is needed to check the reply */
export function buildAccessRequest(req: AccessRequest): { packet: Buffer; identifier: number; authenticator: Buffer } {
  const identifier = req.identifier ?? randomBytes(1)[0]
  const authenticator = req.authenticator ?? randomBytes(16)
  const attrs = [
    attribute(ATTR.USER_NAME, Buffer.from(req.username, 'utf8')),
    attribute(ATTR.USER_PASSWORD, hidePassword(req.password, req.secret, authenticator)),
    attribute(ATTR.NAS_IDENTIFIER, Buffer.from('uptime-kuma', 'utf8')),
  ]
  if (req.calledStationId) attrs.push(attribute(ATTR.CALLED_STATION_ID, Buffer.from(req.calledStationId, 'utf8')))
  if (req.callingStationId) attrs.push(attribute(ATTR.CALLING_STATION_ID, Buffer.from(req.callingStationId, 'utf8')))
  // Message-Authenticator (RFC 3579): servers hardened against BlastRADIUS require it
  attrs.push(attribute(ATTR.MESSAGE_AUTHENTICATOR, Buffer.alloc(16)))

  const body = Buffer.concat(attrs)
  const packet = Buffer.concat([Buffer.alloc(4), authenticator, body])
  packet[0] = 1
  packet[1] = identifier
  packet.writeUInt16BE(packet.length, 2)
  const hmac = createHmac('md5', req.secret).update(packet).digest()
  hmac.copy(packet, packet.length - 16)
  return { packet, identifier, authenticator }
}

export type RadiusReply =
  | { ok: true; code: number; name: string }
  | { ok: false; reason: string }

/** Check a reply: right request, and signed with the shared secret */
export function parseReply(reply: Buffer, identifier: number, requestAuthenticator: Buffer, secret: string): RadiusReply {
  if (reply.length < 20) return { ok: false, reason: 'Reply too short' }
  const length = reply.readUInt16BE(2)
  if (length < 20 || length > reply.length) return { ok: false, reason: 'Malformed reply' }
  if (reply[1] !== identifier) return { ok: false, reason: 'Reply to another request' }
  const expected = md5(reply.subarray(0, 4), requestAuthenticator, reply.subarray(20, length), Buffer.from(secret, 'utf8'))
  if (!expected.equals(reply.subarray(4, 20))) {
    return { ok: false, reason: 'Reply not signed with this secret (wrong shared secret?)' }
  }
  const code = reply[0]
  return { ok: true, code, name: RADIUS_CODES[code] ?? `code ${code}` }
}

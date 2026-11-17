// RADIUS monitors against a throwaway local RADIUS responder that checks the
// Message-Authenticator, recovers the hidden password and signs its reply.
import { createHash, createHmac } from 'node:crypto'
import dgram from 'node:dgram'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildAccessRequest, hidePassword, parseReply } from '../../server/services/monitor/checkers/radius'
import { checkRadius } from '../../server/services/monitor/checkers/network-checker'

const SECRET = 'testing123'
const md5 = (...b: Buffer[]) => createHash('md5').update(Buffer.concat(b)).digest()

function attrs(packet: Buffer): Map<number, Buffer> {
  const out = new Map<number, Buffer>()
  for (let i = 20; i < packet.readUInt16BE(2);) {
    out.set(packet[i], packet.subarray(i + 2, i + packet[i + 1]))
    i += packet[i + 1]
  }
  return out
}

function revealPassword(hidden: Buffer, authenticator: Buffer): string {
  const out = Buffer.alloc(hidden.length)
  let previous = authenticator
  for (let i = 0; i < hidden.length; i += 16) {
    const b = md5(Buffer.from(SECRET), previous)
    for (let j = 0; j < 16; j++) out[i + j] = hidden[i + j] ^ b[j]
    previous = hidden.subarray(i, i + 16)
  }
  return out.toString('utf8').replace(/\0+$/, '')
}

let server: dgram.Socket
let port = 0
let replySecret = SECRET

beforeAll(async () => {
  server = dgram.createSocket('udp4')
  server.on('message', (msg, rinfo) => {
    const a = attrs(msg)
    // Message-Authenticator must be valid
    const zeroed = Buffer.from(msg)
    const maOffset = zeroed.indexOf(Buffer.concat([Buffer.from([80, 18]), a.get(80)!]))
    zeroed.fill(0, maOffset + 2, maOffset + 18)
    const validMa = createHmac('md5', SECRET).update(zeroed).digest().equals(a.get(80)!)
    const user = a.get(1)?.toString()
    const password = revealPassword(a.get(2)!, msg.subarray(4, 20))
    const code = validMa && user === 'alice' && password === 'correct horse battery staple!' ? 2 : 3
    const reply = Buffer.alloc(20)
    reply[0] = code
    reply[1] = msg[1]
    reply.writeUInt16BE(20, 2)
    md5(reply.subarray(0, 4), msg.subarray(4, 20), Buffer.from(replySecret)).copy(reply, 4)
    server.send(reply, rinfo.port, rinfo.address)
  })
  await new Promise<void>(resolve => server.bind(0, '127.0.0.1', () => resolve()))
  port = server.address().port
})

afterAll(() => server?.close())

const monitor = (over: Record<string, unknown> = {}) => ({
  hostname: '127.0.0.1', port, radiusSecret: SECRET, radiusUsername: 'alice',
  radiusPassword: 'correct horse battery staple!', timeout: 3, ...over,
})

describe('RADIUS packets', () => {
  it('hides passwords in 16-byte blocks', () => {
    const auth = Buffer.alloc(16, 7)
    expect(hidePassword('', SECRET, auth)).toHaveLength(16)
    expect(hidePassword('x'.repeat(17), SECRET, auth)).toHaveLength(32)
    expect(revealPassword(hidePassword('pässword', SECRET, auth), auth)).toBe('pässword')
  })

  it('rejects replies that are not signed with the secret', () => {
    const { identifier, authenticator } = buildAccessRequest({ username: 'u', password: 'p', secret: SECRET, identifier: 9 })
    const forged = Buffer.alloc(20)
    forged[0] = 2
    forged[1] = identifier
    forged.writeUInt16BE(20, 2)
    expect(parseReply(forged, identifier, authenticator, SECRET)).toMatchObject({ ok: false })
  })
})

describe('checkRadius', () => {
  it('is up on Access-Accept', async () => {
    expect(await checkRadius(monitor(), Date.now())).toMatchObject({ status: 1, msg: 'Access-Accept' })
  })

  it('is down on Access-Reject', async () => {
    const r = await checkRadius(monitor({ radiusPassword: 'wrong' }), Date.now())
    expect(r.status).toBe(0)
    expect(r.msg).toMatch(/Access-Reject/)
  })

  it('notices a wrong shared secret', async () => {
    replySecret = 'other-secret'
    const r = await checkRadius(monitor(), Date.now())
    replySecret = SECRET
    expect(r.status).toBe(0)
    expect(r.msg).toMatch(/secret/)
  })

  it('needs a username', async () => {
    expect((await checkRadius(monitor({ radiusUsername: '' }), Date.now())).msg).toMatch(/username/)
  })
})

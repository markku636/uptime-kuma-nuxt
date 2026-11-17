// DNS monitors: resolver settings, and a real lookup against a throwaway
// local UDP DNS server (so the configured resolver is provably used).
import dgram from 'node:dgram'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dnsServers, formatRecords, recordType } from '../../server/services/monitor/checkers/dns-options'
import { checkDns } from '../../server/services/monitor/checkers/network-checker'

describe('dnsServers', () => {
  it('splits lists and applies a non-default port', () => {
    expect(dnsServers('1.1.1.1, 8.8.8.8')).toEqual(['1.1.1.1', '8.8.8.8'])
    expect(dnsServers('1.1.1.1 9.9.9.9:5353', 5300)).toEqual(['1.1.1.1:5300', '9.9.9.9:5353'])
    expect(dnsServers('2606:4700::1111', 5300)).toEqual(['[2606:4700::1111]:5300'])
    expect(dnsServers('1.1.1.1', 53)).toEqual(['1.1.1.1'])
    expect(dnsServers('')).toEqual([])
    expect(dnsServers(null)).toEqual([])
  })
})

describe('recordType / formatRecords', () => {
  it('normalises types', () => {
    expect(recordType('aaaa')).toBe('AAAA')
    expect(recordType('BOGUS')).toBe('A')
    expect(recordType(null)).toBe('A')
  })

  it('formats records', () => {
    expect(formatRecords('MX', [{ priority: 10, exchange: 'mx.example' }])).toEqual(['10 mx.example'])
    expect(formatRecords('TXT', [['v=spf1 ', '-all']])).toEqual(['v=spf1 -all'])
    expect(formatRecords('SOA', { nsname: 'ns', hostmaster: 'h', serial: 1 })).toEqual(['ns h 1'])
  })
})

// Answers every A question with 10.1.2.3, everything else with no records
let server: dgram.Socket
let port = 0
let queries = 0

beforeAll(async () => {
  server = dgram.createSocket('udp4')
  server.on('message', (msg, rinfo) => {
    queries++
    // Question: header (12 bytes), then QNAME labels, QTYPE, QCLASS
    let i = 12
    while (msg[i] !== 0) i += msg[i] + 1
    const qEnd = i + 5
    const qtype = msg.readUInt16BE(i + 1)
    const question = msg.subarray(12, qEnd)
    const header = Buffer.alloc(12)
    msg.copy(header, 0, 0, 2) // id
    header.writeUInt16BE(0x8180, 2) // response, recursion available
    header.writeUInt16BE(1, 4) // QDCOUNT
    const answers: Buffer[] = []
    if (qtype === 1) {
      const rr = Buffer.alloc(16)
      rr.writeUInt16BE(0xc00c, 0) // name: pointer to the question
      rr.writeUInt16BE(1, 2) // A
      rr.writeUInt16BE(1, 4) // IN
      rr.writeUInt32BE(60, 6) // TTL
      rr.writeUInt16BE(4, 10)
      Buffer.from([10, 1, 2, 3]).copy(rr, 12)
      answers.push(rr)
    }
    header.writeUInt16BE(answers.length, 6) // ANCOUNT
    server.send(Buffer.concat([header, question, ...answers]), rinfo.port, rinfo.address)
  })
  await new Promise<void>(resolve => server.bind(0, '127.0.0.1', () => resolve()))
  port = server.address().port
})

afterAll(() => server?.close())

describe('checkDns', () => {
  it('asks the configured resolver for the configured record type', async () => {
    const before = queries
    const up = await checkDns({ hostname: 'kuma.test', dnsResolver: `127.0.0.1:${port}`, dnsRecordType: 'A', timeout: 3 }, Date.now())
    expect(up).toMatchObject({ status: 1, msg: 'A: 10.1.2.3' })
    expect(queries).toBeGreaterThan(before)
  })

  it('uses the monitor port for a resolver without one', async () => {
    const up = await checkDns({ hostname: 'kuma.test', dnsResolver: '127.0.0.1', port, timeout: 3 }, Date.now())
    expect(up.status).toBe(1)
  })

  it('reports a record type with no answers as down', async () => {
    const down = await checkDns({ hostname: 'kuma.test', dnsResolver: `127.0.0.1:${port}`, dnsRecordType: 'AAAA', timeout: 3 }, Date.now())
    expect(down.status).toBe(0)
    expect(down.msg).toMatch(/AAAA/)
  })
})

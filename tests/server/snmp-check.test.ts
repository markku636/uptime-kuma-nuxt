// SNMP monitors against a throwaway local SNMP agent (built with
// snmp-native's own encoder), checking the community, OID and comparison.
import dgram from 'node:dgram'
import * as snmp from 'snmp-native'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkSnmp } from '../../server/services/monitor/checkers/network-checker'

const OID = '.1.3.6.1.2.1.1.3.0'
let agent: dgram.Socket
let port = 0
let seenCommunity = ''

beforeAll(async () => {
  agent = dgram.createSocket('udp4')
  agent.on('message', (msg, rinfo) => {
    const req: any = (snmp as any).parse(msg)
    seenCommunity = req.community
    if (req.community !== 'kuma-ro') return // wrong community: agents stay silent
    const res: any = new (snmp as any).Packet()
    res.version = req.version
    res.community = req.community
    res.pdu.type = (snmp as any).PduTypes.GetResponsePDU
    res.pdu.reqid = req.pdu.reqid
    res.pdu.varbinds[0].oid = req.pdu.varbinds[0].oid
    res.pdu.varbinds[0].type = (snmp as any).DataTypes.Integer
    res.pdu.varbinds[0].value = 42
    agent.send((snmp as any).encode(res), rinfo.port, rinfo.address)
  })
  await new Promise<void>(resolve => agent.bind(0, '127.0.0.1', () => resolve()))
  port = agent.address().port
})

afterAll(() => agent?.close())

const monitor = (over: Record<string, unknown> = {}) => ({
  hostname: '127.0.0.1', port, snmpOid: OID, snmpVersion: '2c', radiusPassword: 'kuma-ro', timeout: 2, ...over,
})

describe('checkSnmp', () => {
  it('reads the OID with the stored community', async () => {
    const r = await checkSnmp(monitor(), Date.now())
    expect(seenCommunity).toBe('kuma-ro')
    expect(r.status).toBe(1)
    expect(r.msg).toMatch(/42/)
  })

  it('accepts an OID without the leading dot (as the form asks for it)', async () => {
    expect((await checkSnmp(monitor({ snmpOid: OID.slice(1) }), Date.now())).status).toBe(1)
  })

  it('compares the value with the operator', async () => {
    expect((await checkSnmp(monitor({ jsonPathOperator: '>', expectedValue: '40' }), Date.now())).status).toBe(1)
    expect((await checkSnmp(monitor({ jsonPathOperator: '<', expectedValue: '40' }), Date.now())).status).toBe(0)
  })

  it('times out with a wrong community', async () => {
    const r = await checkSnmp(monitor({ radiusPassword: 'wrong', timeout: 1 }), Date.now())
    expect(r.status).toBe(0)
  })
})

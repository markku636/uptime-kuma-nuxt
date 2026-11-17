// server/services/monitor/checkers/network-checker.ts
import net from 'net'
import dns from 'dns'
import dgram from 'dgram'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { CheckResult } from '../checker'
import { evaluateJsonQuery } from '../../../utils/json-query'
import { dnsServers, formatRecords, recordType } from './dns-options'
import { buildAccessRequest, parseReply } from './radius'

const execAsync = promisify(exec)

export async function checkTcp(monitor: any, startTime: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeout = (monitor.timeout || 48) * 1000

    socket.setTimeout(timeout)

    socket.connect(monitor.port, monitor.hostname, () => {
      const ping = Date.now() - startTime
      socket.destroy()
      resolve({
        status: monitor.upsideDown ? 0 : 1,
        ping,
        msg: 'Connection successful'
      })
    })

    socket.on('error', (err) => {
      const ping = Date.now() - startTime
      socket.destroy()
      resolve({
        status: monitor.upsideDown ? 1 : 0,
        ping,
        msg: err.message
      })
    })

    socket.on('timeout', () => {
      const ping = Date.now() - startTime
      socket.destroy()
      resolve({
        status: monitor.upsideDown ? 1 : 0,
        ping,
        msg: 'Connection timeout'
      })
    })
  })
}

export async function checkPing(monitor: any, startTime: number): Promise<CheckResult> {
  const timeout = monitor.timeout || 48
  const isWindows = process.platform === 'win32'
  
  const cmd = isWindows
    ? `ping -n 1 -w ${timeout * 1000} ${monitor.hostname}`
    : `ping -c 1 -W ${timeout} ${monitor.hostname}`

  try {
    const { stdout } = await execAsync(cmd)
    
    // Extract ping time from output
    let pingTime = Date.now() - startTime
    const match = stdout.match(/time[=<](\d+\.?\d*)\s*ms/i)
    if (match) {
      pingTime = Math.round(parseFloat(match[1]))
    }

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping: pingTime,
      msg: 'Ping successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: 'Ping failed'
    }
  }
}

export async function checkDns(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.hostname) return { status: 0, ping: 0, msg: 'Hostname is required' }
  const type = recordType(monitor.dnsRecordType)
  // The monitor's resolver(s); the system's when empty
  const resolver = new dns.promises.Resolver({ timeout: Math.max(1000, (monitor.timeout || 48) * 1000), tries: 2 })
  const servers = dnsServers(monitor.dnsResolver, monitor.port)
  const via = servers.length ? ` via ${servers.join(', ')}` : ''

  try {
    if (servers.length) resolver.setServers(servers)
    const records = formatRecords(type, await resolver.resolve(monitor.hostname, type))
    const ping = Date.now() - startTime
    if (!records.length) {
      return { status: monitor.upsideDown ? 1 : 0, ping, msg: `No ${type} records${via}` }
    }
    return { status: monitor.upsideDown ? 0 : 1, ping, msg: `${type}: ${records.join(', ')}` }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: `${type} lookup failed${via}: ${error?.code || error?.message || 'DNS resolution failed'}`,
    }
  } finally {
    resolver.cancel()
  }
}

export async function checkRadius(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.hostname || !monitor.radiusSecret) {
    return { status: 0, ping: 0, msg: 'RADIUS hostname and secret are required' }
  }
  if (!monitor.radiusUsername) {
    return { status: 0, ping: 0, msg: 'RADIUS username is required' }
  }
  const timeout = (monitor.timeout || 48) * 1000
  const port = monitor.port || 1812
  let request
  try {
    request = buildAccessRequest({
      username: monitor.radiusUsername,
      password: monitor.radiusPassword || '',
      secret: monitor.radiusSecret,
      calledStationId: monitor.radiusCalledStationId,
      callingStationId: monitor.radiusCallingStationId,
    })
  } catch (error: any) {
    return { status: 0, ping: 0, msg: error?.message || 'Invalid RADIUS settings' }
  }

  return new Promise((resolve) => {
    const client = dgram.createSocket(net.isIPv6(monitor.hostname) ? 'udp6' : 'udp4')
    let done = false
    const finish = (up: boolean, msg: string) => {
      if (done) return
      done = true
      clearTimeout(timer)
      client.close()
      resolve({ status: (monitor.upsideDown ? !up : up) ? 1 : 0, ping: Date.now() - startTime, msg })
    }
    const timer = setTimeout(() => finish(false, `RADIUS server did not answer within ${timeout / 1000}s`), timeout)

    client.on('message', (msg) => {
      const reply = parseReply(msg, request.identifier, request.authenticator, monitor.radiusSecret)
      if ('reason' in reply) return finish(false, reply.reason)
      // Only an accepted login means the service works end to end
      finish(reply.code === 2, reply.code === 3 ? 'Access-Reject: check the username and password' : reply.name)
    })
    client.on('error', err => finish(false, err.message || 'RADIUS check failed'))
    client.send(request.packet, port, monitor.hostname)
  })
}

export async function checkTailscalePing(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    if (!monitor.hostname) {
      return {
        status: 0,
        ping: 0,
        msg: 'Tailscale hostname is required'
      }
    }

    const cmd = `tailscale ping --timeout=${monitor.timeout || 48}s ${monitor.hostname}`
    
    const { stdout } = await execAsync(cmd)
    const ping = Date.now() - startTime

    // Parse Tailscale ping output
    const match = stdout.match(/in\s+(\d+\.?\d*)\s*(ms|s)/i)
    let latency = ping
    if (match) {
      latency = parseFloat(match[1])
      if (match[2].toLowerCase() === 's') {
        latency *= 1000
      }
      latency = Math.round(latency)
    }

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping: latency,
      msg: 'Tailscale ping successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'Tailscale ping failed'
    }
  }
}

/**
 * Check SNMP monitor
 * Queries an SNMP OID and evaluates the result against a JSONPath expression
 */
export async function checkSnmp(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.hostname) return { status: 0, ping: 0, msg: 'SNMP hostname is required' }
  if (!monitor.snmpOid) return { status: 0, ping: 0, msg: 'SNMP OID is required' }
  if (monitor.snmpVersion === '3') return { status: 0, ping: 0, msg: 'SNMPv3 is not supported yet; use v1 or v2c' }

  const snmp: any = await import('snmp-native')
  const timeout = (monitor.timeout || 48) * 1000
  const session = new snmp.Session({
    host: monitor.hostname,
    port: monitor.port || 161,
    // The community string is kept in radiusPassword (as in uptime-kuma)
    community: monitor.radiusPassword || 'public',
    version: monitor.snmpVersion === '1' ? 0 : 1,
    timeouts: [timeout],
  })

  const outcome = await new Promise<{ up: boolean; msg: string; ping: number }>((resolve) => {
    let settled = false
    // Settle once; closing the session calls pending callbacks again
    const settle = (up: boolean, msg: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ up, msg, ping: Date.now() - startTime })
    }
    const timer = setTimeout(() => settle(false, `SNMP timeout after ${timeout / 1000}s (check host, port and community)`), timeout + 500)

    session.get({ oid: monitor.snmpOid }, (error: any, varbinds: any[]) => {
      if (settled) return
      if (error) return settle(false, `SNMP error: ${error.message || error}`)
      if (!varbinds?.length) return settle(false, `No value returned for OID ${monitor.snmpOid}`)
      const value = varbinds[0]?.value
      evaluateJsonQuery(value, monitor.jsonPath, monitor.jsonPathOperator, monitor.expectedValue)
        .then(({ status, response }) => {
          const expected = monitor.jsonPathOperator && monitor.expectedValue ? ` ${monitor.jsonPathOperator} ${monitor.expectedValue}` : ''
          settle(!!status, `SNMP value ${response}${expected ? (status ? ` (matches${expected})` : ` (expected${expected})`) : ''}`)
        })
        .catch((e: any) => settle(false, `SNMP evaluation error: ${e?.message || e}`))
    })
  })

  try { session.close() } catch { /* already closed */ }
  const up = monitor.upsideDown ? !outcome.up : outcome.up
  return { status: up ? 1 : 0, ping: outcome.ping, msg: outcome.msg }
}

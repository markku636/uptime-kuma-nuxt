// server/services/monitor/checkers/network-checker.ts
import net from 'net'
import dns from 'dns'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { CheckResult } from '../checker'
import { evaluateJsonQuery } from '../../../utils/json-query'

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
  const dnsPromises = dns.promises

  try {
    // Get custom DNS server if specified
    let resolver = dnsPromises
    if (monitor.dnsServer) {
      const dnsResolver = new dns.Resolver()
      dnsResolver.setServers([monitor.dnsServer])
      resolver = dnsResolver.resolve4 as any
    }

    // Determine record type
    const recordType = monitor.dnsResolveType || 'A'
    let addresses: string[]

    switch (recordType.toUpperCase()) {
      case 'A':
        addresses = await dnsPromises.resolve4(monitor.hostname)
        break
      case 'AAAA':
        addresses = await dnsPromises.resolve6(monitor.hostname)
        break
      case 'MX':
        const mxRecords = await dnsPromises.resolveMx(monitor.hostname)
        addresses = mxRecords.map(r => `${r.priority} ${r.exchange}`)
        break
      case 'TXT':
        const txtRecords = await dnsPromises.resolveTxt(monitor.hostname)
        addresses = txtRecords.flat()
        break
      case 'CNAME':
        addresses = [await dnsPromises.resolveCname(monitor.hostname).then(r => r[0])]
        break
      case 'NS':
        addresses = await dnsPromises.resolveNs(monitor.hostname)
        break
      case 'SOA':
        const soa = await dnsPromises.resolveSoa(monitor.hostname)
        addresses = [`${soa.nsname} ${soa.hostmaster}`]
        break
      case 'PTR':
        addresses = await dnsPromises.resolvePtr(monitor.hostname)
        break
      case 'SRV':
        const srvRecords = await dnsPromises.resolveSrv(monitor.hostname)
        addresses = srvRecords.map(r => `${r.priority} ${r.weight} ${r.port} ${r.name}`)
        break
      case 'CAA':
        const caaRecords = await dnsPromises.resolveCaa(monitor.hostname)
        addresses = caaRecords.map(r => `${r.critical} ${r.issue || r.issuewild || r.iodef}`)
        break
      default:
        addresses = await dnsPromises.resolve4(monitor.hostname)
    }

    const ping = Date.now() - startTime

    // Check for expected result if specified
    if (monitor.dnsExpectedResult) {
      const found = addresses.some(addr => addr.includes(monitor.dnsExpectedResult))
      if (!found) {
        return {
          status: monitor.upsideDown ? 1 : 0,
          ping,
          msg: `Expected '${monitor.dnsExpectedResult}', got: ${addresses.join(', ')}`
        }
      }
    }

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: `Resolved: ${addresses.join(', ')}`
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'DNS resolution failed'
    }
  }
}

export async function checkRadius(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    // Note: This requires a proper Radius client library
    // Using a simplified approach with dgram for basic connectivity
    const dgram = await import('dgram')
    
    if (!monitor.hostname || !monitor.radiusSecret) {
      return {
        status: 0,
        ping: 0,
        msg: 'RADIUS hostname and secret are required'
      }
    }

    return new Promise((resolve) => {
      const timeout = (monitor.timeout || 48) * 1000
      const client = dgram.createSocket('udp4')
      const port = monitor.port || 1812

      const timeoutId = setTimeout(() => {
        client.close()
        resolve({
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: 'RADIUS server timeout'
        })
      }, timeout)

      // Simple RADIUS Access-Request packet (simplified)
      const packet = Buffer.alloc(20)
      packet[0] = 1 // Code: Access-Request
      packet[1] = 1 // Identifier
      packet.writeUInt16BE(20, 2) // Length

      client.on('message', () => {
        clearTimeout(timeoutId)
        client.close()
        resolve({
          status: monitor.upsideDown ? 0 : 1,
          ping: Date.now() - startTime,
          msg: 'RADIUS server responded'
        })
      })

      client.on('error', (err) => {
        clearTimeout(timeoutId)
        client.close()
        resolve({
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: err.message || 'RADIUS check failed'
        })
      })

      client.send(packet, port, monitor.hostname)
    })
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'RADIUS check failed'
    }
  }
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
  let session: any = null
  
  try {
    // Dynamic import of net-snmp
    const snmp = await import('snmp-native')
    
    if (!monitor.hostname) {
      return {
        status: 0,
        ping: 0,
        msg: 'SNMP hostname is required'
      }
    }
    
    if (!monitor.snmpOid) {
      return {
        status: 0,
        ping: 0,
        msg: 'SNMP OID is required'
      }
    }
    
    const port = monitor.port || 161
    const timeout = (monitor.timeout || 48) * 1000
    const community = monitor.radiusSecret || 'public' // sealed secret field doubles as the SNMP community
    const snmpVersion = monitor.snmpVersion || '2c'
    
    return new Promise(async (resolve) => {
      try {
        // Create SNMP session
        const sessionOptions: any = {
          host: monitor.hostname,
          port,
          community,
          timeouts: [timeout]
        }
        
        // Map version string to SNMP version constant
        if (snmpVersion === '1') {
          sessionOptions.version = 0 // SNMPv1
        } else if (snmpVersion === '2c') {
          sessionOptions.version = 1 // SNMPv2c
        }
        // Note: SNMPv3 requires additional configuration (authProtocol, privProtocol, etc.)
        
        session = new snmp.Session(sessionOptions)
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (session) {
            session.close()
          }
          resolve({
            status: monitor.upsideDown ? 1 : 0,
            ping: Date.now() - startTime,
            msg: 'SNMP timeout'
          })
        }, timeout)
        
        // Perform SNMP GET
        session.get({ oid: monitor.snmpOid }, (error: any, varbinds: any) => {
          clearTimeout(timeoutId)
          
          if (error) {
            if (session) {
              session.close()
            }
            resolve({
              status: monitor.upsideDown ? 1 : 0,
              ping: Date.now() - startTime,
              msg: `SNMP error: ${error.message || error}`
            })
            return
          }
          
          const ping = Date.now() - startTime
          
          if (!varbinds || varbinds.length === 0) {
            if (session) {
              session.close()
            }
            resolve({
              status: monitor.upsideDown ? 1 : 0,
              ping,
              msg: `No varbinds returned from SNMP session (OID: ${monitor.snmpOid})`
            })
            return
          }
          
          const value = varbinds[0]?.value
          
          console.log(`[SNMP] Received value for OID ${monitor.snmpOid}: ${value}`)
          
          // Evaluate JSON query if specified
          evaluateJsonQuery(
            value,
            monitor.jsonPath,
            monitor.jsonPathOperator,
            monitor.expectedValue
          ).then(({ status, response }) => {
            if (session) {
              session.close()
            }
            
            if (status) {
              resolve({
                status: monitor.upsideDown ? 0 : 1,
                ping,
                msg: `SNMP query passed (value: ${response}, expected: ${monitor.expectedValue || 'any'})`
              })
            } else {
              resolve({
                status: monitor.upsideDown ? 1 : 0,
                ping,
                msg: `SNMP query failed (value: ${response}, expected: ${monitor.expectedValue || 'any'})`
              })
            }
          }).catch((e: any) => {
            if (session) {
              session.close()
            }
            resolve({
              status: monitor.upsideDown ? 1 : 0,
              ping,
              msg: `SNMP evaluation error: ${e.message}`
            })
          })
        })
      } catch (err: any) {
        if (session) {
          session.close()
        }
        resolve({
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: `SNMP session error: ${err.message}`
        })
      }
    })
  } catch (error: any) {
    if (session) {
      session.close()
    }
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: `SNMP check failed: ${error.message}`
    }
  }
}

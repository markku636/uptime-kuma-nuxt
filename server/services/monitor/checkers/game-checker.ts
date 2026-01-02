// server/services/monitor/checkers/game-checker.ts
import type { CheckResult } from '../checker'
import axios from 'axios'

export async function checkSteam(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    if (!monitor.hostname || !monitor.port) {
      return {
        status: 0,
        ping: 0,
        msg: 'Steam server hostname and port are required'
      }
    }

    // Use Steam A2S query protocol
    const dgram = await import('dgram')
    
    return new Promise((resolve) => {
      const timeout = (monitor.timeout || 48) * 1000
      const client = dgram.createSocket('udp4')

      const timeoutId = setTimeout(() => {
        client.close()
        resolve({
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: 'Steam server query timeout'
        })
      }, timeout)

      // A2S_INFO query packet
      const queryPacket = Buffer.from([
        0xFF, 0xFF, 0xFF, 0xFF, // Prefix
        0x54, // A2S_INFO
        0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00 // "Source Engine Query\0"
      ])

      client.on('message', (msg) => {
        clearTimeout(timeoutId)
        client.close()
        
        const ping = Date.now() - startTime
        
        // Parse response to get server name
        let serverName = 'Unknown'
        try {
          // Skip header (5 bytes) and find null-terminated string
          const dataStart = 6
          const nameEnd = msg.indexOf(0, dataStart)
          if (nameEnd > dataStart) {
            serverName = msg.slice(dataStart, nameEnd).toString('utf8')
          }
        } catch {
          // Ignore parsing errors
        }

        resolve({
          status: monitor.upsideDown ? 0 : 1,
          ping,
          msg: `Steam server online: ${serverName}`
        })
      })

      client.on('error', (err) => {
        clearTimeout(timeoutId)
        client.close()
        resolve({
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: err.message || 'Steam server query failed'
        })
      })

      client.send(queryPacket, monitor.port, monitor.hostname)
    })
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'Steam check failed'
    }
  }
}

export async function checkGamedig(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const Gamedig = await import('gamedig')
    
    if (!monitor.hostname || !monitor.game) {
      return {
        status: 0,
        ping: 0,
        msg: 'Game server hostname and game type are required'
      }
    }

    const queryOptions: any = {
      type: monitor.game,
      host: monitor.hostname,
      port: monitor.port,
      maxRetries: 1,
      socketTimeout: (monitor.timeout || 48) * 1000,
      attemptTimeout: (monitor.timeout || 48) * 1000
    }

    const state = await Gamedig.query(queryOptions)
    const ping = state.ping || (Date.now() - startTime)

    // Build detailed message
    let msg = `${state.name || 'Server'} - Players: ${state.players?.length || 0}`
    if (state.maxplayers) {
      msg += `/${state.maxplayers}`
    }
    if (state.map) {
      msg += ` - Map: ${state.map}`
    }

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'Game server check failed'
    }
  }
}

// server/services/security-scan/tls-probe.ts
// 被動 TLS 版本探測：只做 handshake，不傳資料、不送出 HTTP 請求。
// 先解析並確認所有位址都是 public，再對「釘住的 IP」握手（servername 用原 host），避免 DNS rebinding。

import tls from 'node:tls'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isForbiddenAddress } from '../monitor/checkers/http-request'

export interface TlsProbeResult {
  /** 是否接受 TLS 1.0 / 1.1（兩者任一即可）。 */
  legacy: boolean
  /** 握手失敗的版本的錯誤摘要（最多 6 項）。 */
  errors: string[]
}

export type TlsProber = (host: string, port: number, servername: string) => Promise<TlsProbeResult>

const LEGACY_VERSIONS = ['TLSv1', 'TLSv1.1'] as const

export const defaultTlsProber: TlsProber = async (host, port, servername) => {
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address, false))) {
    return { legacy: false, errors: ['DESTINATION_DENIED'] }
  }
  const pinned = addresses.find(({ family }) => family === 6)?.address || addresses[0]!.address
  const errors: string[] = []
  for (const version of LEGACY_VERSIONS) {
    const accepted = await new Promise<boolean>(resolve => {
      let socket: tls.TLSSocket
      try {
        socket = tls.connect({
          host: pinned, port, servername,
          minVersion: version, maxVersion: version,
          rejectUnauthorized: false, timeout: 4000,
        })
      } catch (error: any) {
        resolve(false)
        if (errors.length < 6) errors.push(`${version}: ${String(error?.message || error).slice(0, 120)}`)
        return
      }
      const fail = (message: string) => {
        socket.destroy()
        resolve(false)
        if (errors.length < 6) errors.push(`${version}: ${message.slice(0, 120)}`)
      }
      socket.once('secureConnect', () => { socket.destroy(); resolve(true) })
      socket.once('error', (error: Error) => fail(error.message))
      socket.once('timeout', () => fail('timeout'))
    })
    if (accepted) return { legacy: true, errors }
  }
  return { legacy: false, errors }
}

// server/services/monitor/checkers/tls-checker.ts
import tls from 'tls'
import https from 'https'
import type { CheckResult } from '../checker'

export interface TLSInfo {
  valid: boolean
  issuer: string
  subject: string
  validFrom: Date | null
  validTo: Date | null
  daysRemaining: number
  fingerprint: string
  serialNumber: string
  subjectAltName: string[]
}

/**
 * Get TLS certificate info from a URL
 */
export async function getTLSInfo(url: string, timeout: number = 10000): Promise<TLSInfo | null> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url)
      
      if (urlObj.protocol !== 'https:') {
        resolve(null)
        return
      }

      const port = urlObj.port ? parseInt(urlObj.port) : 443
      const hostname = urlObj.hostname

      const options: tls.ConnectionOptions = {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false, // We want to get cert info even if invalid
        timeout
      }

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate(false)
        
        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy()
          resolve(null)
          return
        }

        const validFrom = cert.valid_from ? new Date(cert.valid_from) : null
        const validTo = cert.valid_to ? new Date(cert.valid_to) : null
        
        let daysRemaining = -1
        if (validTo) {
          const now = new Date()
          daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Parse subject alt names
        const subjectAltName: string[] = []
        if (cert.subjectaltname) {
          const parts = cert.subjectaltname.split(', ')
          for (const part of parts) {
            if (part.startsWith('DNS:')) {
              subjectAltName.push(part.substring(4))
            }
          }
        }

        const info: TLSInfo = {
          valid: socket.authorized,
          issuer: cert.issuer ? formatCertName(cert.issuer) : '',
          subject: cert.subject ? formatCertName(cert.subject) : '',
          validFrom,
          validTo,
          daysRemaining,
          fingerprint: cert.fingerprint || '',
          serialNumber: cert.serialNumber || '',
          subjectAltName
        }

        socket.destroy()
        resolve(info)
      })

      socket.on('error', (err) => {
        console.error('TLS connection error:', err.message)
        socket.destroy()
        resolve(null)
      })

      socket.on('timeout', () => {
        console.error('TLS connection timeout')
        socket.destroy()
        resolve(null)
      })
    } catch (error) {
      console.error('Error getting TLS info:', error)
      resolve(null)
    }
  })
}

/**
 * Format certificate name object to string
 */
function formatCertName(name: any): string {
  if (typeof name === 'string') return name
  
  const parts: string[] = []
  if (name.CN) parts.push(`CN=${name.CN}`)
  if (name.O) parts.push(`O=${name.O}`)
  if (name.OU) parts.push(`OU=${name.OU}`)
  if (name.C) parts.push(`C=${name.C}`)
  if (name.ST) parts.push(`ST=${name.ST}`)
  if (name.L) parts.push(`L=${name.L}`)
  
  return parts.join(', ')
}

/**
 * Check if certificate expiry notification should be sent
 */
export function shouldSendCertExpiryNotification(
  daysRemaining: number, 
  expiryNotificationDays: number[]
): boolean {
  return expiryNotificationDays.includes(daysRemaining)
}

/**
 * Check TLS certificate and return result
 */
export async function checkTLS(monitor: any, startTime: number): Promise<CheckResult & { tlsInfo?: TLSInfo }> {
  if (!monitor.url) {
    return {
      status: 0,
      ping: 0,
      msg: 'URL is required for TLS check'
    }
  }

  const tlsInfo = await getTLSInfo(monitor.url, (monitor.timeout || 48) * 1000)
  const ping = Date.now() - startTime

  if (!tlsInfo) {
    return {
      status: 0,
      ping,
      msg: 'Failed to retrieve TLS certificate info'
    }
  }

  // Check expiry
  if (monitor.expiryNotification && monitor.tlsExpiryDays) {
    const expiryDays = Array.isArray(monitor.tlsExpiryDays) 
      ? monitor.tlsExpiryDays 
      : [monitor.tlsExpiryDays]
    
    // This is just for checking - actual notification is sent separately
    if (tlsInfo.daysRemaining <= Math.max(...expiryDays)) {
      return {
        status: 1, // Still up but warning
        ping,
        msg: `Certificate expires in ${tlsInfo.daysRemaining} days`,
        tlsInfo
      }
    }
  }

  // Check if certificate is valid
  if (!tlsInfo.valid && !monitor.ignoreTls) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping,
      msg: 'Certificate is not valid',
      tlsInfo
    }
  }

  // Check if certificate is expired
  if (tlsInfo.daysRemaining < 0) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping,
      msg: 'Certificate has expired',
      tlsInfo
    }
  }

  return {
    status: monitor.upsideDown ? 0 : 1,
    ping,
    msg: `Certificate valid for ${tlsInfo.daysRemaining} days`,
    tlsInfo
  }
}

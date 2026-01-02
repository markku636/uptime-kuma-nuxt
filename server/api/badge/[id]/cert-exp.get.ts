// server/api/badge/[id]/cert-exp.get.ts
import { generateBadge } from '../../../services/badge/generator'
import tls from 'tls'

// Get SSL certificate expiry for a monitor
async function getCertificateInfo(hostname: string, port: number = 443): Promise<{ daysRemaining: number; validTo: Date } | null> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect({
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false
      }, () => {
        const cert = socket.getPeerCertificate()
        socket.end()
        
        if (cert && cert.valid_to) {
          const validTo = new Date(cert.valid_to)
          const now = new Date()
          const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          resolve({ daysRemaining, validTo })
        } else {
          resolve(null)
        }
      })
      
      socket.on('error', () => {
        resolve(null)
      })
      
      socket.setTimeout(10000, () => {
        socket.end()
        resolve(null)
      })
    } catch {
      resolve(null)
    }
  })
}

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Get monitor
  const monitor = await prisma.monitor.findUnique({
    where: { id }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Only HTTP(S) monitors with URLs can have certificates
  if (!monitor.url) {
    const svg = generateBadge('Cert Exp', 'N/A', '#808080')
    setResponseHeader(event, 'Content-Type', 'image/svg+xml')
    return svg
  }

  try {
    const url = new URL(monitor.url)
    
    // Only HTTPS has certificates
    if (url.protocol !== 'https:') {
      const svg = generateBadge('Cert Exp', 'N/A', '#808080')
      setResponseHeader(event, 'Content-Type', 'image/svg+xml')
      return svg
    }

    const certInfo = await getCertificateInfo(url.hostname, parseInt(url.port) || 443)
    
    if (!certInfo) {
      const svg = generateBadge('Cert Exp', 'Error', '#e74c3c')
      setResponseHeader(event, 'Content-Type', 'image/svg+xml')
      return svg
    }

    // Determine color based on days remaining
    let color = '#2ecc71' // Green - good
    if (certInfo.daysRemaining < 30) color = '#f1c40f' // Yellow - warning
    if (certInfo.daysRemaining < 14) color = '#e67e22' // Orange - soon
    if (certInfo.daysRemaining < 7) color = '#e74c3c' // Red - critical
    if (certInfo.daysRemaining < 0) color = '#c0392b' // Dark red - expired

    const label = certInfo.daysRemaining < 0 ? 'Expired' : `${certInfo.daysRemaining} days`
    const svg = generateBadge('Cert Exp', label, color)

    setResponseHeader(event, 'Content-Type', 'image/svg+xml')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
    
    return svg
  } catch {
    const svg = generateBadge('Cert Exp', 'Error', '#e74c3c')
    setResponseHeader(event, 'Content-Type', 'image/svg+xml')
    return svg
  }
})

// server/api/v1/monitors/[id]/certificate.get.ts
import { prisma } from '~/server/utils/prisma'
import { getTLSInfo } from '~/server/services/monitor/checkers'
import { resolveMonitorUrl } from '~/server/services/variables/service'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  const monitor = await prisma.monitor.findUnique({
    where: { id }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // The stored URL may use {{variables}}
  const url = await resolveMonitorUrl(monitor)
  if (!url || !url.startsWith('https://')) {
    return {
      hasCertificate: false,
      message: 'Monitor does not use HTTPS'
    }
  }

  try {
    const tlsInfo = await getTLSInfo(url, (monitor.timeout || 48) * 1000)

    if (!tlsInfo) {
      return {
        hasCertificate: false,
        message: 'Unable to retrieve certificate information'
      }
    }

    return {
      hasCertificate: true,
      certificate: {
        valid: tlsInfo.valid,
        issuer: tlsInfo.issuer,
        subject: tlsInfo.subject,
        validFrom: tlsInfo.validFrom,
        validTo: tlsInfo.validTo,
        daysRemaining: tlsInfo.daysRemaining,
        fingerprint: tlsInfo.fingerprint,
        serialNumber: tlsInfo.serialNumber,
        subjectAltName: tlsInfo.subjectAltName
      }
    }
  } catch (error: any) {
    return {
      hasCertificate: false,
      message: error.message || 'Failed to retrieve certificate'
    }
  }
})

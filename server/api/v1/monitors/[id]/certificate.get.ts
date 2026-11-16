// server/api/v1/monitors/[id]/certificate.get.ts
import { prisma } from '~/server/utils/prisma'
import { getTLSInfo } from '~/server/services/monitor/checkers'
import { resolveMonitorUrl, variablesForMonitor } from '~/server/services/variables/service'
import { maskSecrets } from '~/server/services/variables/resolve'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Only the owner may probe a monitor (its URL can carry secret variables)
  const monitor = await prisma.monitor.findFirst({
    where: { id, userId: (session.user as any).id }
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
      // The error may echo the filled URL: hide secret values
      message: maskSecrets(String(error?.message || 'Failed to retrieve certificate'), (await variablesForMonitor(monitor.userId, monitor.workspaceId ?? null).catch(() => ({ secrets: [] as string[] }))).secrets)
    }
  }
})

import { monitorEditorDTO } from '../../../utils/monitor-secrets'
import { heartbeatSummary, monitorSummary } from '../../../utils/serialize'
// server/api/v1/monitors/[id].get.ts

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '')
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: session.workspaceId, environmentId: session.environmentId },
    include: {
      heartbeats: {
        take: 50,
        orderBy: [{ time: 'desc' },{id:'desc'}]
      },
      tags: { include: { tag: true } },
      monitorNotifications: {
        include: { notification: true }
      }
    }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Convert BigInt to string for JSON serialization
  const serializedMonitor = {
    ...monitor,
    heartbeats: monitor.heartbeats.map(heartbeatSummary)
  }

  return {
    ok: true,
    data: session.role === 'viewer' ? monitorSummary(serializedMonitor) : monitorEditorDTO(serializedMonitor)
  }
})

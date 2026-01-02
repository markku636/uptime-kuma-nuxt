// server/api/v1/monitors/[id].delete.ts
import { stopMonitorJob } from '../../../services/monitor/scheduler'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
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

  // Check if monitor exists and belongs to user
  const existingMonitor = await prisma.monitor.findFirst({
    where: { 
      id,
      userId: session.user.id 
    }
  })

  if (!existingMonitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Stop the monitor job first
  stopMonitorJob(id)

  // Delete monitor (cascades to heartbeats, tags, etc.)
  await prisma.monitor.delete({
    where: { id }
  })

  return {
    ok: true,
    message: 'Monitor deleted successfully'
  }
})

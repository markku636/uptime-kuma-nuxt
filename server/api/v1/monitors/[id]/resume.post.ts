// server/api/v1/monitors/[id]/resume.post.ts
import { scheduleGroupRecheck, startMonitorJob } from '../../../../services/monitor/scheduler'

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

  const monitor = await prisma.monitor.update({
    where: { id },
    data: { active: true, pausedByGroup: null }
  })

  // Start the monitor job
  startMonitorJob(monitor)
  scheduleGroupRecheck(monitor.parent)

  return {
    ok: true,
    message: 'Monitor resumed',
    data: monitor
  }
})

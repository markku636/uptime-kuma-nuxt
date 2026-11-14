import {fenceMonitorData} from '../../../../utils/monitor-mutation'
import { monitorEditorDTO } from '../../../../utils/monitor-secrets'
// server/api/v1/monitors/[id]/resume.post.ts
import { startMonitorJob } from '../../../../services/monitor/scheduler'

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

  // Check if monitor exists and belongs to user
  const existingMonitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: session.workspaceId, environmentId: session.environmentId }
  })

  if (!existingMonitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  const monitor=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM monitors WHERE id=${id} FOR UPDATE`
    const current=await tx.monitor.findFirstOrThrow({where:{id,workspaceId:session.workspaceId,environmentId:session.environmentId}})
    return tx.monitor.update({where:{id},data:await fenceMonitorData(tx,current,{active:true})})
  })

  // Start the monitor job
  startMonitorJob(monitor)

  return {
    ok: true,
    message: 'Monitor resumed',
    data: monitorEditorDTO(monitor)
  }
})

import {fenceMonitorData} from '../../../utils/monitor-mutation'
// server/api/v1/monitors/[id].put.ts
import { Prisma } from '@prisma/client'
import { hydrateMonitor, monitorEditorDTO, monitorSecretUpdate } from '../../../utils/monitor-secrets'
import { startMonitorJob, stopMonitorJob } from '../../../services/monitor/scheduler'

import { createMonitorSchema } from '../../../utils/monitor-input'
const updateMonitorSchema = createMonitorSchema.partial()

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

  const body = await readBody(event)
  
  // Validate input
  const result = updateMonitorSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  // Zod 4 applies defaults even inside partial(); only apply fields explicitly sent.
  const data = Object.fromEntries(Object.entries(result.data).filter(([key]) => Object.hasOwn(body, key))) as typeof result.data

  const { tags, notifications, ...monitorData } = data
  const monitor = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM monitors WHERE id=${id} FOR UPDATE`
    const current=await tx.monitor.findFirstOrThrow({where:{id,workspaceId:session.workspaceId,environmentId:session.environmentId}})
    // url 是敏感欄位，DB 裡是 NULL；要從 seal/envelope 還原後才判斷是否為空。
    if (monitorData.type === 'visual-diff') {
      const url = Object.hasOwn(monitorData, 'url') ? monitorData.url : hydrateMonitor(current).url
      if (!url) throw createError({statusCode:400,message:'URL is required for visual-diff monitors'})
    }
    if (monitorData.proxyId) { await assertWorkspaceIds(tx, 'proxy', [monitorData.proxyId], session.workspaceId); throw createError({statusCode:400,message:'HTTP proxy transport is not supported'}) }
    if (monitorData.dockerHost && /^\d+$/.test(monitorData.dockerHost)) await assertWorkspaceIds(tx, 'dockerHost', [Number(monitorData.dockerHost)], session.workspaceId)
    if (monitorData.remoteBrowserId) await assertWorkspaceIds(tx, 'remoteBrowser', [monitorData.remoteBrowserId], session.workspaceId)
    if (monitorData.parent) await assertWorkspaceIds(tx, 'monitor', [monitorData.parent], session.workspaceId)
    if (tags) {
      const ids = await assertWorkspaceIds(tx, 'tag', tags, session.workspaceId)
      await tx.monitorTag.deleteMany({ where: { monitorId: id } })
      if (ids.length) await tx.monitorTag.createMany({ data: ids.map(tagId => ({ monitorId: id, tagId })) })
    }
    if (notifications) {
      const ids = await assertWorkspaceIds(tx, 'notification', notifications, session.workspaceId)
      await tx.monitorNotification.deleteMany({ where: { monitorId: id } })
      if (ids.length) await tx.monitorNotification.createMany({ data: ids.map(notificationId => ({ monitorId: id, notificationId })) })
    }
    // Read again inside the transaction so concurrent partial edits preserve current values.
    const updated:any=await fenceMonitorData(tx,current,monitorSecretUpdate(current,monitorData))
    for(const key of ['assertions','acceptedStatuscodes','tlsExpiryDays']) if(updated[key]===null)updated[key]=Prisma.DbNull
    return tx.monitor.update({ where:{id},data:updated,include:{tags:{include:{tag:true}},monitorNotifications:true} })
  })

  // Restart the monitor job with new settings
  if (monitor.active) {
    startMonitorJob(monitor)
  } else {
    stopMonitorJob(monitor.id)
  }

  return {
    ok: true,
    data: monitorEditorDTO(monitor)
  }
})

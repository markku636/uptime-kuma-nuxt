import {databaseNow,initialMonitorSchedule} from '../../../utils/monitor-mutation'
// server/api/v1/monitors/index.post.ts
import { monitorEditorDTO, reserveMonitorId, monitorDbInput } from '../../../utils/monitor-secrets'
import { nanoid } from 'nanoid'
import { startMonitorJob } from '../../../services/monitor/scheduler'

import { createMonitorSchema } from '../../../utils/monitor-input'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  
  // Validate input
  const result = createMonitorSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const data = result.data

  // Validate based on monitor type
  if (['http','keyword','json-query'].includes(data.type) && !data.url) {
    throw createError({
      statusCode: 400,
      message: 'URL is required for HTTP monitors'
    })
  }

  // visual-diff 需要真瀏覽器載入的目標頁；設定本身由 createMonitorSchema 的 visualConfigSchema 驗證。
  if (data.type === 'visual-diff' && !data.url) {
    throw createError({
      statusCode: 400,
      message: 'URL is required for visual-diff monitors'
    })
  }

  if (['tcp', 'ping', 'dns'].includes(data.type) && !data.hostname) {
    throw createError({
      statusCode: 400,
      message: 'Hostname is required for this monitor type'
    })
  }

  // Generate push token for push monitors
  const pushToken = data.type === 'push' ? nanoid(32) : undefined

  // Extract tags and notifications for separate handling
  const { tags, notifications, clearSecrets, ...monitorData } = data

  const updatedMonitor = await prisma.$transaction(async tx => {
    const tagIds = await assertWorkspaceIds(tx, 'tag', tags || [], session.workspaceId)
    const notificationIds = await assertWorkspaceIds(tx, 'notification', notifications || [], session.workspaceId)
    if (monitorData.proxyId) { await assertWorkspaceIds(tx, 'proxy', [monitorData.proxyId], session.workspaceId); throw createError({statusCode:400,message:'HTTP proxy transport is not supported'}) }
    if (monitorData.remoteBrowserId) await assertWorkspaceIds(tx, 'remoteBrowser', [monitorData.remoteBrowserId], session.workspaceId)
    if (monitorData.dockerHost && /^\d+$/.test(monitorData.dockerHost)) await assertWorkspaceIds(tx, 'dockerHost', [Number(monitorData.dockerHost)], session.workspaceId)
    if (monitorData.parent) await assertWorkspaceIds(tx, 'monitor', [monitorData.parent], session.workspaceId)
    const id=await reserveMonitorId(tx)
    const input:any={...monitorData,...initialMonitorSchedule(id,monitorData.interval,await databaseNow(tx)),id,workspaceId:session.workspaceId,environmentId:session.environmentId,userId:session.user.id,pushToken}
    for(const key of ['assertions','acceptedStatuscodes','tlsExpiryDays']) if(input[key]===null)delete input[key]
    const monitor = await tx.monitor.create({data:monitorDbInput(input)})
    if (tagIds.length) await tx.monitorTag.createMany({ data: tagIds.map(tagId => ({ monitorId: monitor.id, tagId })) })
    if (notificationIds.length) await tx.monitorNotification.createMany({ data: notificationIds.map(notificationId => ({ monitorId: monitor.id, notificationId })) })
    return tx.monitor.findUniqueOrThrow({ where: { id: monitor.id }, include: { tags: { include: { tag: true } }, monitorNotifications: true } })
  })

  // Start the monitor job if active
  if (updatedMonitor && updatedMonitor.active) {
    startMonitorJob(updatedMonitor)
  }

  return {
    ok: true,
    data: monitorEditorDTO(updatedMonitor),
    ...(pushToken ? { provisioning: { pushToken } } : {})
  }
})

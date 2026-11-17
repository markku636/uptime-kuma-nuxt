// server/api/v1/monitors/[id].put.ts
import { scheduleGroupRecheck, startMonitorJob, stopMonitorJob } from '../../../services/monitor/scheduler'
import { normalizeMonitorPayload } from '../../../services/monitor/status-codes'
import { normalizeMonitorFields, updateMonitorSchema } from '../../../services/monitor/fields'
import { prismaColumns, replaceMonitorRelations } from '../../../services/monitor/save'
import { WorkspaceError, resolvePlacement, syncMembersAfterMove } from '../../../services/workspace/service'

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

  // Accept both monitor forms' shapes (headers as JSON string, basic_auth_* keys, "200-299, 404")
  // and the edit form's own keys (maxredirects, dns_resolve_server, notificationIDList…)
  const body = normalizeMonitorFields(normalizeMonitorPayload(await readBody(event)))
  
  // Validate input
  const result = updateMonitorSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const data = result.data

  // A monitor inside a group always lives in the group's workspace
  const current = { parent: existingMonitor.parent, workspaceId: existingMonitor.workspaceId }
  const placement = await resolvePlacement(session.user.id, id, data, current).catch((e) => {
    if (e instanceof WorkspaceError) throw createError({ statusCode: e.statusCode, message: e.message })
    throw e
  })

  const monitor = await prisma.monitor.update({
    where: { id },
    data: {
      ...prismaColumns(data),
      ...placement,
      // Pausing / resuming by hand makes the state the monitor's own
      ...(data.active !== undefined && data.active !== existingMonitor.active ? { pausedByGroup: null } : {}),
    },
    include: {
      tags: { include: { tag: true } }
    }
  })

  await replaceMonitorRelations(session.user.id, id, { tags: data.tags, notifications: data.notifications })

  if (placement.workspaceId !== current.workspaceId) {
    await syncMembersAfterMove(session.user.id, monitor)
  }

  // Membership or the active flag changed: the old and the new group re-evaluate
  if (placement.parent !== current.parent || monitor.active !== existingMonitor.active) {
    scheduleGroupRecheck([current.parent, placement.parent])
  }

  // Restart the monitor job with new settings
  if (monitor.active) {
    startMonitorJob(monitor)
  } else {
    stopMonitorJob(monitor.id)
  }

  return {
    ok: true,
    data: monitor
  }
})

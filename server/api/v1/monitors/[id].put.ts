// server/api/v1/monitors/[id].put.ts
import { z } from 'zod'
import { scheduleGroupRecheck, startMonitorJob, stopMonitorJob } from '../../../services/monitor/scheduler'
import { normalizeMonitorPayload } from '../../../services/monitor/status-codes'
import { WorkspaceError, resolvePlacement, syncMembersAfterMove } from '../../../services/workspace/service'

const updateMonitorSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),  // Support all 24 monitor types
  url: z.string().optional(),
  hostname: z.string().optional(),
  port: z.number().optional(),
  interval: z.number().optional(),
  timeout: z.number().optional(),
  retryInterval: z.number().optional(),
  maxretries: z.number().optional(),
  method: z.string().optional(),
  body: z.string().optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  acceptedStatuscodes: z.array(z.string()).optional(),
  keyword: z.string().optional(),
  invertKeyword: z.boolean().optional(),
  ignoreTls: z.boolean().optional(),
  upsideDown: z.boolean().optional(),
  authMethod: z.string().optional(),
  basicAuthUser: z.string().optional(),
  basicAuthPass: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  weight: z.number().optional(),
  // Organization: group (parent) and workspace
  parent: z.number().int().positive().nullable().optional(),
  workspaceId: z.number().int().positive().nullable().optional(),
})

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
  const body = normalizeMonitorPayload(await readBody(event))
  
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
      ...data,
      ...placement,
      headers: data.headers ? data.headers : undefined,
    },
    include: {
      tags: { include: { tag: true } }
    }
  })

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

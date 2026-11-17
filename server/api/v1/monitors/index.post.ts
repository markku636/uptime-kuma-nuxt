// server/api/v1/monitors/index.post.ts
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { scheduleGroupRecheck, startMonitorJob } from '../../../services/monitor/scheduler'
import { normalizeMonitorPayload } from '../../../services/monitor/status-codes'
import { monitorFields, normalizeMonitorFields } from '../../../services/monitor/fields'
import { prismaColumns, replaceMonitorRelations } from '../../../services/monitor/save'
import { WorkspaceError, resolvePlacement } from '../../../services/workspace/service'

// Every settable column (see services/monitor/fields.ts); name and type are required
const createMonitorSchema = z.object({
  ...monitorFields,
  name: z.string().min(1, 'Name is required').max(150),
  type: z.string().min(1, 'Type is required'),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  // Accept both monitor forms' shapes (headers as JSON string, basic_auth_* keys, "200-299, 404")
  const body = normalizeMonitorFields(normalizeMonitorPayload(await readBody(event)))
  
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
  if (data.type === 'http' && !data.url) {
    throw createError({
      statusCode: 400,
      message: 'URL is required for HTTP monitors'
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
  const { tags, notifications, parent, workspaceId } = data

  // A monitor inside a group always lives in the group's workspace
  const placement = await resolvePlacement(session.user.id, null, { parent, workspaceId }).catch((e) => {
    if (e instanceof WorkspaceError) throw createError({ statusCode: e.statusCode, message: e.message })
    throw e
  })

  const monitor = await prisma.monitor.create({
    data: {
      ...(prismaColumns(data) as any),
      ...placement,
      userId: session.user.id,
      pushToken,
    },
    include: {
      tags: { include: { tag: true } }
    }
  })

  // Tags and notifications (only the user's own)
  await replaceMonitorRelations(session.user.id, monitor.id, { tags: tags ?? undefined, notifications: notifications ?? undefined })

  // Fetch the updated monitor with all relations
  const updatedMonitor = await prisma.monitor.findUnique({
    where: { id: monitor.id },
    include: {
      tags: { include: { tag: true } },
      monitorNotifications: { include: { notification: true } }
    }
  })

  // Start the monitor job if active
  if (updatedMonitor && updatedMonitor.active) {
    startMonitorJob(updatedMonitor)
  }
  scheduleGroupRecheck(updatedMonitor?.parent)

  return {
    ok: true,
    data: updatedMonitor
  }
})

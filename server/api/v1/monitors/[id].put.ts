// server/api/v1/monitors/[id].put.ts
import { z } from 'zod'
import { startMonitorJob, stopMonitorJob } from '../../../services/monitor/scheduler'

const updateMonitorSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['http', 'tcp', 'ping', 'dns', 'push', 'docker']).optional(),
  url: z.string().optional(),
  hostname: z.string().optional(),
  port: z.number().optional(),
  interval: z.number().optional(),
  timeout: z.number().optional(),
  retryInterval: z.number().optional(),
  maxretries: z.number().optional(),
  method: z.string().optional(),
  body: z.string().optional(),
  headers: z.record(z.string()).optional(),
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

  const body = await readBody(event)
  
  // Validate input
  const result = updateMonitorSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const data = result.data

  const monitor = await prisma.monitor.update({
    where: { id },
    data: {
      ...data,
      headers: data.headers ? data.headers : undefined,
    },
    include: {
      tags: { include: { tag: true } }
    }
  })

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

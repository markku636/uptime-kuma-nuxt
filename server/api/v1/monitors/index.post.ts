// server/api/v1/monitors/index.post.ts
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { startMonitorJob } from '../../../services/monitor/scheduler'

const createMonitorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['http', 'tcp', 'ping', 'dns', 'push', 'docker', 'keyword', 'json-query', 'grpc-keyword', 'database']),
  url: z.string().optional().nullable(),
  hostname: z.string().optional().nullable(),
  port: z.number().optional().nullable(),
  interval: z.number().default(60),
  timeout: z.number().default(48),
  retryInterval: z.number().default(60),
  maxretries: z.number().default(0),
  method: z.string().default('GET'),
  body: z.string().optional().nullable(),
  headers: z.record(z.string()).optional().nullable(),
  keyword: z.string().optional().nullable(),
  jsonPath: z.string().optional().nullable(),
  expectedValue: z.string().optional().nullable(),
  invertKeyword: z.boolean().default(false),
  ignoreTls: z.boolean().default(false),
  upsideDown: z.boolean().default(false),
  authMethod: z.string().optional().nullable(),
  basicAuthUser: z.string().optional().nullable(),
  basicAuthPass: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  maxRedirects: z.number().default(10).nullable(),
  active: z.boolean().default(true),
  // TLS Certificate settings
  expiryNotification: z.boolean().default(false),
  tlsExpiryDays: z.array(z.number()).optional().nullable(),
  // DNS settings
  dnsRecordType: z.string().optional().nullable(),
  dnsResolver: z.string().optional().nullable(),
  // Docker settings
  dockerHost: z.number().optional().nullable(),
  dockerContainer: z.string().optional().nullable(),
  // Database settings
  databaseType: z.string().optional().nullable(),
  databaseConnectionString: z.string().optional().nullable(),
  databaseQuery: z.string().optional().nullable(),
  // Proxy
  proxyId: z.number().optional().nullable(),
  // Tags and notifications
  tags: z.array(z.number()).optional().nullable(),
  notifications: z.array(z.number()).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
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
  const { tags, notifications, tlsExpiryDays, ...monitorData } = data

  const monitor = await prisma.monitor.create({
    data: {
      ...monitorData,
      userId: session.user.id,
      pushToken,
      headers: monitorData.headers ? monitorData.headers : undefined,
      tlsExpiryDays: tlsExpiryDays ? tlsExpiryDays : undefined,
    },
    include: {
      tags: { include: { tag: true } }
    }
  })

  // Add tags if provided
  if (tags && tags.length > 0) {
    await prisma.monitorTag.createMany({
      data: tags.map((tagId: number) => ({
        monitorId: monitor.id,
        tagId,
      })),
      skipDuplicates: true,
    })
  }

  // Add notifications if provided
  if (notifications && notifications.length > 0) {
    await prisma.monitorNotification.createMany({
      data: notifications.map((notificationId: number) => ({
        monitorId: monitor.id,
        notificationId,
      })),
      skipDuplicates: true,
    })
  }

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

  return {
    ok: true,
    data: updatedMonitor
  }
})

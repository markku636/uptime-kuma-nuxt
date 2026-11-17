// server/api/v1/monitors/[id]/heartbeats.get.ts
import { z } from 'zod'

const MAX_HEARTBEATS = 10_000

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_HEARTBEATS).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  // The last N hours (the monitor page asks for 24); without it the latest `limit`
  hours: z.coerce.number().positive().max(24 * 366).optional(),
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

  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0].message })
  const { offset, hours } = parsed.data
  const limit = parsed.data.limit ?? (hours ? MAX_HEARTBEATS : 100)
  const where = hours
    ? { monitorId: id, time: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) } }
    : { monitorId: id }

  const heartbeats = await prisma.heartbeat.findMany({
    where,
    orderBy: { time: 'desc' },
    take: limit,
    skip: offset,
  })

  const total = await prisma.heartbeat.count({ where })

  // Convert BigInt to string for JSON serialization
  const serializedHeartbeats = heartbeats.map(hb => ({
    ...hb,
    id: hb.id.toString()
  }))

  return {
    ok: true,
    data: serializedHeartbeats,
    total,
    limit,
    offset
  }
})

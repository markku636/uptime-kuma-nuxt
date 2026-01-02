// server/api/v1/monitors/[id]/heartbeats.get.ts
import { z } from 'zod'

const querySchema = z.object({
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
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
  const { limit, offset } = querySchema.parse(query)

  const heartbeats = await prisma.heartbeat.findMany({
    where: { monitorId: id },
    orderBy: { time: 'desc' },
    take: limit,
    skip: offset,
  })

  const total = await prisma.heartbeat.count({
    where: { monitorId: id }
  })

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

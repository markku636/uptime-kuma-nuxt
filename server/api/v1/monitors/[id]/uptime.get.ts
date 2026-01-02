// server/api/v1/monitors/[id]/uptime.get.ts
import { z } from 'zod'
import { calculateUptimeByPeriod, getDailyUptimeHistory } from '../../../../services/uptime/calculator'

const querySchema = z.object({
  period: z.enum(['24h', '7d', '30d', '1y', 'all']).optional().default('all'),
  history: z.enum(['true', 'false']).optional().default('false'),
  historyDays: z.coerce.number().min(1).max(365).optional().default(90)
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const monitorId = parseInt(getRouterParam(event, 'id') || '0')
  
  if (!monitorId) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Verify monitor belongs to user
  const monitor = await prisma.monitor.findFirst({
    where: {
      id: monitorId,
      userId: session.user.id
    },
    select: { id: true, name: true }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  const query = getQuery(event)
  const params = querySchema.safeParse(query)
  
  if (!params.success) {
    throw createError({
      statusCode: 400,
      message: params.error.issues[0].message
    })
  }

  const { period, history, historyDays } = params.data

  // Get uptime by period
  const uptimeByPeriod = await calculateUptimeByPeriod(monitorId)

  const result: any = {
    monitorId,
    monitorName: monitor.name
  }

  if (period === 'all') {
    result.uptime = uptimeByPeriod
  } else {
    result.uptime = uptimeByPeriod[period as keyof typeof uptimeByPeriod]
  }

  // Include daily history if requested
  if (history === 'true') {
    result.history = await getDailyUptimeHistory(monitorId, historyDays)
  }

  return {
    ok: true,
    data: result
  }
})

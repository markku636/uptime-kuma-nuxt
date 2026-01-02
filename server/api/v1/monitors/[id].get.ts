// server/api/v1/monitors/[id].get.ts

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

  const monitor = await prisma.monitor.findFirst({
    where: { 
      id,
      userId: session.user.id 
    },
    include: {
      heartbeats: {
        take: 100,
        orderBy: { time: 'desc' }
      },
      tags: { include: { tag: true } },
      monitorNotifications: {
        include: { notification: true }
      }
    }
  })

  if (!monitor) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Convert BigInt to string for JSON serialization
  const serializedMonitor = {
    ...monitor,
    heartbeats: monitor.heartbeats.map(hb => ({
      ...hb,
      id: hb.id.toString()
    }))
  }

  return {
    ok: true,
    data: serializedMonitor
  }
})

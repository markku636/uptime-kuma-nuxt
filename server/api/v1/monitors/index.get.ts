// server/api/v1/monitors/index.get.ts

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const monitors = await prisma.monitor.findMany({
    where: { userId: session.user.id },
    include: {
      heartbeats: {
        take: 50,
        orderBy: { time: 'desc' }
      },
      tags: { 
        include: { tag: true } 
      }
    },
    orderBy: { weight: 'asc' }
  })

  // Convert BigInt to string for JSON serialization
  const serializedMonitors = monitors.map(monitor => ({
    ...monitor,
    heartbeats: monitor.heartbeats.map(hb => ({
      ...hb,
      id: hb.id.toString()
    }))
  }))

  return { 
    ok: true, 
    data: serializedMonitors 
  }
})

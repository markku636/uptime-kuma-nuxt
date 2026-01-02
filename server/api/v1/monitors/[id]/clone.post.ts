// server/api/v1/monitors/[id]/clone.post.ts
import { startMonitorJob } from '../../../../services/monitor/scheduler'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const id = Number(getRouterParam(event, 'id'))
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid monitor ID'
    })
  }

  // Find original monitor
  const original = await prisma.monitor.findFirst({
    where: { 
      id,
      userId: session.user.id 
    },
    include: {
      tags: { include: { tag: true } },
      monitorNotifications: true
    }
  })

  if (!original) {
    throw createError({
      statusCode: 404,
      message: 'Monitor not found'
    })
  }

  // Remove fields that shouldn't be cloned
  const { 
    id: _id, 
    createdAt, 
    updatedAt, 
    pushToken,
    tags,
    monitorNotifications,
    ...monitorData 
  } = original

  // Generate new push token if it's a push monitor
  const newPushToken = monitorData.type === 'push' 
    ? Math.random().toString(36).substring(2, 34) 
    : undefined

  // Create cloned monitor
  const cloned = await prisma.monitor.create({
    data: {
      ...monitorData,
      name: `${original.name} (Copy)`,
      pushToken: newPushToken,
    }
  })

  // Clone tags
  if (tags && tags.length > 0) {
    await prisma.monitorTag.createMany({
      data: tags.map(t => ({
        monitorId: cloned.id,
        tagId: t.tagId
      }))
    })
  }

  // Clone notifications
  if (monitorNotifications && monitorNotifications.length > 0) {
    await prisma.monitorNotification.createMany({
      data: monitorNotifications.map(n => ({
        monitorId: cloned.id,
        notificationId: n.notificationId
      }))
    })
  }

  // Fetch complete cloned monitor
  const result = await prisma.monitor.findUnique({
    where: { id: cloned.id },
    include: {
      tags: { include: { tag: true } },
      monitorNotifications: { include: { notification: true } }
    }
  })

  // Start the monitor job if active
  if (result && result.active) {
    startMonitorJob(result)
  }

  return {
    ok: true,
    data: result
  }
})

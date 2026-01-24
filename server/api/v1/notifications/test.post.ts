// server/api/v1/notifications/test.post.ts
import { sendNotification } from '../../../services/notification/sender'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  
  // Support both direct test (type + config) and by notificationId
  let notificationType: string
  let notificationConfig: any
  
  if (body.notificationId) {
    // Test existing notification by ID
    const notification = await prisma.notification.findFirst({
      where: { id: body.notificationId, userId: session.user.id }
    })
    
    if (!notification) {
      throw createError({
        statusCode: 404,
        message: 'Notification not found'
      })
    }
    
    notificationType = notification.type
    notificationConfig = notification.config
  } else if (body.type && body.config) {
    // Direct test with type and config
    notificationType = body.type
    notificationConfig = body.config
  } else {
    throw createError({
      statusCode: 400,
      message: 'Either notificationId or type+config is required'
    })
  }

  try {
    await sendNotification(
      { type: notificationType, config: notificationConfig },
      { name: 'Test Monitor', url: 'https://example.com' },
      { status: 1, ping: 100, msg: 'Test notification from Uptime Kuma' }
    )

    return {
      ok: true,
      message: 'Test notification sent successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Failed to send test notification: ${error.message}`
    })
  }
})

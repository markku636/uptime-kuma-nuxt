// server/api/v1/notifications/[id].delete.ts
import { prisma } from '~/server/utils/prisma'

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
      message: 'Invalid notification ID'
    })
  }

  // Check ownership
  const existing = await prisma.notification.findFirst({
    where: { id, userId: session.user.id }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Notification not found'
    })
  }

  await prisma.notification.delete({
    where: { id }
  })

  return {
    ok: true,
    message: 'Notification deleted successfully'
  }
})

// server/api/v1/notifications/[id].put.ts
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

  const body = await readBody(event)
  
  // Build update data
  const updateData: any = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.type !== undefined) updateData.type = body.type
  if (body.config !== undefined) updateData.config = body.config
  if (body.isDefault !== undefined) updateData.isDefault = body.isDefault
  if (body.active !== undefined) updateData.active = body.active

  const notification = await prisma.notification.update({
    where: { id },
    data: updateData
  })

  return {
    ok: true,
    data: notification
  }
})

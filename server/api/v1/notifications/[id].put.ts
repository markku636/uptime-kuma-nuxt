// server/api/v1/notifications/[id].put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const updateNotificationSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['discord', 'slack', 'telegram', 'email', 'webhook', 'line']).optional(),
  config: z.record(z.any()).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
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
  const result = updateNotificationSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const notification = await prisma.notification.update({
    where: { id },
    data: result.data
  })

  return {
    ok: true,
    data: notification
  }
})

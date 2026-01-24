// server/api/v1/notifications/index.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const createNotificationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  config: z.any().default({}),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
}).passthrough()

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  
  // Basic validation
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Name is required'
    })
  }
  
  if (!body.type || typeof body.type !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Type is required'
    })
  }

  const notification = await prisma.notification.create({
    data: {
      name: body.name.trim(),
      type: body.type,
      config: body.config || {},
      isDefault: body.isDefault ?? false,
      active: body.active ?? true,
      userId: session.user.id,
    }
  })

  return {
    ok: true,
    data: notification
  }
})

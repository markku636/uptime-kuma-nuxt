// server/api/v1/notifications/index.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const createNotificationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['discord', 'slack', 'telegram', 'email', 'webhook', 'line']),
  config: z.record(z.any()),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  
  const result = createNotificationSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const notification = await prisma.notification.create({
    data: {
      ...result.data,
      userId: session.user.id,
    }
  })

  return {
    ok: true,
    data: notification
  }
})

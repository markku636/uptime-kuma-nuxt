// server/api/v1/notifications/test.post.ts
import { z } from 'zod'
import { sendNotification } from '../../../services/notification/sender'

const testSchema = z.object({
  type: z.enum(['discord', 'slack', 'telegram', 'email', 'webhook', 'line']),
  config: z.record(z.any()),
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
  const result = testSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  try {
    await sendNotification(
      { type: result.data.type, config: result.data.config },
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

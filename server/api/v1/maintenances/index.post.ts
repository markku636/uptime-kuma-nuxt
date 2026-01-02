// server/api/v1/maintenances/index.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const createMaintenanceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  strategy: z.enum(['manual', 'single', 'recurring-interval', 'recurring-weekday', 'recurring-day-of-month', 'cron']).default('manual'),
  active: z.boolean().default(true),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  cron: z.string().optional(),
  duration: z.number().min(1).default(60), // Duration in minutes
  timezone: z.string().default('UTC'),
  monitorIds: z.array(z.number()).optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const result = createMaintenanceSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const data = result.data

  // Create maintenance
  const maintenance = await prisma.maintenance.create({
    data: {
      title: data.title,
      description: data.description,
      strategy: data.strategy,
      active: data.active,
      startDate: data.startDate,
      endDate: data.endDate,
      cron: data.cron,
      duration: data.duration,
      timezone: data.timezone
    }
  })

  return {
    ok: true,
    data: maintenance
  }
})

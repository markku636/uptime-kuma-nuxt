// server/api/v1/maintenances/[id].put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const updateMaintenanceSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  strategy: z.enum(['manual', 'single', 'recurring-interval', 'recurring-weekday', 'recurring-day-of-month', 'cron']).optional(),
  active: z.boolean().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  cron: z.string().optional(),
  duration: z.number().min(1).optional(),
  timezone: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '0')
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Invalid maintenance ID'
    })
  }

  const body = await readBody(event)
  const result = updateMaintenanceSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  // Check if maintenance exists
  const existing = await prisma.maintenance.findUnique({
    where: { id }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Maintenance not found'
    })
  }

  // Update maintenance
  const maintenance = await prisma.maintenance.update({
    where: { id },
    data: result.data
  })

  return {
    ok: true,
    data: maintenance
  }
})

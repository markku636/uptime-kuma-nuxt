// server/api/v1/maintenance/index.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const createMaintenanceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  strategy: z.enum(['manual', 'recurring']).default('manual'),
  active: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cron: z.string().optional(),
  duration: z.number().default(60),
  timezone: z.string().default('UTC'),
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
  const result = createMaintenanceSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const data = result.data
  const maintenance = await prisma.maintenance.create({
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    }
  })

  return {
    ok: true,
    data: maintenance
  }
})

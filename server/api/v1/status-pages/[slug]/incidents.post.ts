// server/api/v1/status-pages/[slug]/incidents.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const createIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  style: z.enum(['info', 'warning', 'danger', 'success']).default('warning'),
  pin: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug is required'
    })
  }

  const statusPage = await prisma.statusPage.findUnique({
    where: { slug }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  const body = await readBody(event)
  const result = createIncidentSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const incident = await prisma.incident.create({
    data: {
      ...result.data,
      statusPageId: statusPage.id,
    }
  })

  return {
    ok: true,
    data: incident
  }
})

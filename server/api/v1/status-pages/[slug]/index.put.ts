// server/api/v1/status-pages/[slug]/index.put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const updateStatusPageSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  theme: z.string().optional(),
  published: z.boolean().optional(),
  showTags: z.boolean().optional(),
  showPoweredBy: z.boolean().optional(),
  customCss: z.string().optional(),
  footerText: z.string().optional(),
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

  const existing = await prisma.statusPage.findUnique({
    where: { slug }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  const body = await readBody(event)
  const result = updateStatusPageSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const statusPage = await prisma.statusPage.update({
    where: { slug },
    data: result.data
  })

  return {
    ok: true,
    data: statusPage
  }
})

// server/api/v1/status-pages/index.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const createStatusPageSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  theme: z.string().default('auto'),
  published: z.boolean().default(true),
  showTags: z.boolean().default(false),
  showPoweredBy: z.boolean().default(true),
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

  const body = await readBody(event)
  const result = createStatusPageSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  // Check if slug already exists
  const existing = await prisma.statusPage.findUnique({
    where: { slug: result.data.slug }
  })

  if (existing) {
    throw createError({
      statusCode: 400,
      message: 'Status page with this slug already exists'
    })
  }

  const statusPage = await prisma.statusPage.create({
    data: result.data
  })

  return {
    ok: true,
    data: statusPage
  }
})

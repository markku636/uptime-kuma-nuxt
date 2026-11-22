// server/api/v1/status-pages/index.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/password'

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
  googleAnalyticsId: z.string().max(200).nullable().optional(),
  password: z.union([z.literal(''), z.string().min(6).max(200)]).optional(),
  monitors: z.array(z.number().int().positive()).max(4000).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
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
  const existing = await prisma.statusPage.findFirst({
    where: { slug: result.data.slug, workspaceId: session.workspaceId }
  })

  if (existing) {
    throw createError({
      statusCode: 400,
      message: 'Status page with this slug already exists'
    })
  }

  const { password, monitors, ...data } = result.data
  const passwordHash = password ? await hashPassword(password) : null
  const statusPage = await prisma.$transaction(async tx => {
    const page = await tx.statusPage.create({
      data: {
        ...data,
        ...(passwordHash ? { passwordHash } : {}),
        workspaceId: session.workspaceId,
        userId: session.user.id,
      },
    })
    if (monitors?.length) {
      await assertWorkspaceIds(tx, 'monitor', monitors, session.workspaceId)
      const group = await tx.statusPageGroup.create({
        data: { statusPageId: page.id, name: 'Monitors', weight: 1 },
      })
      await tx.statusPageMonitor.createMany({
        data: [...new Set(monitors)].map(monitorId => ({ groupId: group.id, monitorId, sendUrl: false })),
      })
    }
    return page
  })

  return {
    ok: true,
    data: statusPage
  }
})

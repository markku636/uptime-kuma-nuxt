// server/api/v1/status-pages/[slug]/index.put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const groupMonitorSchema = z.object({
  id: z.number()
})

const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  weight: z.number(),
  monitorList: z.array(groupMonitorSchema)
})

const updateStatusPageSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  theme: z.string().optional(),
  published: z.boolean().optional(),
  showTags: z.boolean().optional(),
  showPoweredBy: z.boolean().optional(),
  showCertificateExpiry: z.boolean().optional(),
  customCss: z.string().optional(),
  footerText: z.string().optional(),
  domainNameList: z.array(z.string()).optional(),
  googleAnalyticsId: z.string().optional(),
  publicGroupList: z.array(groupSchema).optional(),
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

  // Verify ownership
  if (existing.userId !== session.user.id) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to modify this status page'
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

  const { publicGroupList, domainNameList, ...statusPageData } = result.data

  // Update status page basic info
  const statusPage = await prisma.statusPage.update({
    where: { slug },
    data: {
      ...statusPageData,
      domainNameList: domainNameList ? JSON.stringify(domainNameList) : undefined
    }
  })

  // Update groups if provided
  if (publicGroupList) {
    // Use transaction to update groups
    await prisma.$transaction(async (tx) => {
      // Delete existing group-monitor associations
      await tx.statusPageGroup.deleteMany({
        where: { statusPageId: statusPage.id }
      })

      // Create new groups with monitor associations
      for (const group of publicGroupList) {
        // Check if group exists (positive ID) or create new
        if (group.id > 0) {
          // Update existing group
          await tx.statusPageGroup.upsert({
            where: { id: group.id },
            create: {
              statusPageId: statusPage.id,
              name: group.name,
              weight: group.weight,
              monitors: {
                connect: group.monitorList.map(m => ({ id: m.id }))
              }
            },
            update: {
              name: group.name,
              weight: group.weight,
              monitors: {
                set: group.monitorList.map(m => ({ id: m.id }))
              }
            }
          })
        } else {
          // Create new group
          await tx.statusPageGroup.create({
            data: {
              statusPageId: statusPage.id,
              name: group.name,
              weight: group.weight,
              monitors: {
                connect: group.monitorList.map(m => ({ id: m.id }))
              }
            }
          })
        }
      }
    })
  }

  return {
    ok: true,
    data: statusPage
  }
})

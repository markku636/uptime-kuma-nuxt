// server/api/v1/status-pages/[slug]/index.put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/password'

const groupMonitorSchema = z.object({
  id: z.number()
})

const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  weight: z.number().optional().default(1),
  monitorList: z.array(groupMonitorSchema)
})

const updateStatusPageSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  published: z.boolean().optional(),
  password: z.string().min(6).max(200).nullable().optional(),
  showTags: z.boolean().optional(),
  showPoweredBy: z.boolean().optional(),
  showCertificateExpiry: z.boolean().optional(),
  customCss: z.string().nullable().optional(),
  customCSS: z.string().nullable().optional(),
  footerText: z.string().nullable().optional(),
  domainNameList: z.array(z.string()).nullable().optional(),
  googleAnalyticsId: z.string().nullable().optional(),
  autoRefreshInterval: z.number().nullable().optional(),
  perPage: z.number().min(1).max(50).nullable().optional(),
  publicGroupList: z.array(groupSchema).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
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

  const existing = await prisma.statusPage.findFirst({
    where: { slug, workspaceId: session.workspaceId }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Verify ownership

  const body = await readBody(event)
  
  
  const result = updateStatusPageSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const { publicGroupList, domainNameList, customCSS, password, ...statusPageData } = result.data

  if (domainNameList?.length) throw createError({ statusCode: 400, message: 'Custom domains are not supported by this deployment' })
  // Explicit nulls must survive so nullable fields can be cleared.
  const updateData: Record<string, unknown> = Object.fromEntries(Object.entries(statusPageData).filter(([, value]) => value !== undefined))
  if (password !== undefined) updateData.passwordHash = password === null ? null : await hashPassword(password)
  if (customCSS !== undefined) updateData.customCss = customCSS
  const statusPage = await prisma.$transaction(async tx => {
    const current = await tx.statusPage.findFirst({ where: { slug, workspaceId: session.workspaceId } })
    if (!current) throw createError({ statusCode: 404, message: 'Status page not found' })
    if (publicGroupList) {
      if (publicGroupList.length > 100) throw createError({ statusCode: 400, message: 'Too many groups' })
      const groups = await tx.statusPageGroup.findMany({ where: { statusPageId: current.id }, select: { id: true } })
      const existingIds = new Set(groups.map(group => group.id))
      const requestedIds = publicGroupList.filter(group => group.id > 0).map(group => group.id)
      if (requestedIds.some(id => !existingIds.has(id)) || new Set(requestedIds).size !== requestedIds.length) {
        throw createError({ statusCode: 404, message: 'Group not found' })
      }
      await assertWorkspaceIds(tx, 'monitor', publicGroupList.flatMap(group => group.monitorList.map(monitor => monitor.id)), session.workspaceId)
      await tx.statusPageGroup.deleteMany({ where: { statusPageId: current.id, id: { notIn: requestedIds } } })
      for (const [index, group] of publicGroupList.entries()) {
        const data = { name: group.name, weight: group.weight ?? index + 1 }
        const saved = group.id > 0
          ? await tx.statusPageGroup.update({ where: { id: group.id, statusPageId: current.id }, data })
          : await tx.statusPageGroup.create({ data: { ...data, statusPageId: current.id } })
        await tx.statusPageMonitor.deleteMany({ where: { groupId: saved.id } })
        const monitors = [...new Map(group.monitorList.map((monitor: any) => [monitor.id, monitor])).values()]
        if (monitors.length) await tx.statusPageMonitor.createMany({ data: monitors.map((monitor: any) => ({
          groupId: saved.id,
          monitorId: monitor.id,
          sendUrl: monitor.sendUrl === true,
        })) })
      }
    }
    return tx.statusPage.update({ where: { id: current.id, workspaceId: session.workspaceId }, data: updateData })
  })
  return { ok: true, data: statusPage }
})

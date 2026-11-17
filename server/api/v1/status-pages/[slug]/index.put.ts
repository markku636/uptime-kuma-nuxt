// server/api/v1/status-pages/[slug]/index.put.ts
import { invalidateStatusDomains } from '../../../../middleware/status-domain'
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const groupMonitorSchema = z.object({
  id: z.number()
})

const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  // Accepted for compatibility; the position in the list is the order
  weight: z.number().optional(),
  monitorList: z.array(groupMonitorSchema)
})

const updateStatusPageSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  published: z.boolean().optional(),
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

/** A page's domains: a JSON array, or a JSON string saved by older versions */
function domainsOf(value: unknown): string[] {
  let list = value
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { return [] }
  }
  return Array.isArray(list) ? list.filter((d): d is string => typeof d === 'string').map(d => d.toLowerCase()) : []
}

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
  
  console.log('PUT /api/v1/status-pages - Received body:', JSON.stringify(body, null, 2))
  console.log('PUT /api/v1/status-pages - publicGroupList count:', body.publicGroupList?.length)
  
  const result = updateStatusPageSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const { publicGroupList, domainNameList, customCSS, ...statusPageData } = result.data

  // Build update data, filtering out null/undefined values
  const updateData: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(statusPageData)) {
    if (value !== undefined && value !== null) {
      updateData[key] = value
    }
  }
  
  // Handle customCSS (frontend uses customCSS, db uses customCss)
  if (customCSS !== undefined && customCSS !== null) {
    updateData.customCss = customCSS
  }
  
  // Custom domains: host names only (no scheme / path), lower case, unique;
  // a host already used by another status page is refused
  if (domainNameList !== undefined) {
    const hosts = [...new Set((domainNameList ?? [])
      .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean))]
    const invalid = hosts.find(h => !/^[a-z0-9.-]+(:\d+)?$/.test(h))
    if (invalid) throw createError({ statusCode: 400, message: `Invalid domain: ${invalid}` })
    if (hosts.length) {
      const others = await prisma.statusPage.findMany({ where: { NOT: { slug } }, select: { title: true, domainNameList: true } })
      for (const other of others) {
        const taken = hosts.find(h => domainsOf(other.domainNameList).includes(h))
        if (taken) throw createError({ statusCode: 409, message: `${taken} is already used by "${other.title}"` })
      }
    }
    updateData.domainNameList = hosts
  }

  // Update status page basic info
  const statusPage = await prisma.statusPage.update({
    where: { slug },
    data: updateData
  })
  if (domainNameList !== undefined) invalidateStatusDomains()

  // Update groups if provided
  if (publicGroupList) {
    console.log('Processing publicGroupList with', publicGroupList.length, 'groups')
    
    // Use transaction to update groups
    await prisma.$transaction(async (tx) => {
      // Get existing groups
      const existingGroups = await tx.statusPageGroup.findMany({
        where: { statusPageId: statusPage.id }
      })
      const existingGroupIds = existingGroups.map(g => g.id)
      
      // IDs in the request (only positive IDs, negative means new)
      const requestGroupIds = publicGroupList.filter(g => g.id > 0).map(g => g.id)
      
      // Delete groups that are no longer in the list (cascade will delete monitors)
      const groupsToDelete = existingGroupIds.filter(id => !requestGroupIds.includes(id))
      if (groupsToDelete.length > 0) {
        await tx.statusPageGroup.deleteMany({
          where: { id: { in: groupsToDelete } }
        })
      }

      // Create or update groups
      for (let i = 0; i < publicGroupList.length; i++) {
        const group = publicGroupList[i]
        // The list is in display order: its position is the order (a weight sent
        // back from an earlier load would keep stale or tied values)
        const weight = i + 1
        
        let groupId: number
        
        if (group.id > 0 && existingGroupIds.includes(group.id)) {
          // Update existing group
          await tx.statusPageGroup.update({
            where: { id: group.id },
            data: {
              name: group.name,
              weight: weight
            }
          })
          groupId = group.id
          
          // Delete existing monitor associations for this group
          await tx.statusPageMonitor.deleteMany({
            where: { groupId: groupId }
          })
        } else {
          // Create new group
          const newGroup = await tx.statusPageGroup.create({
            data: {
              statusPageId: statusPage.id,
              name: group.name,
              weight: weight
            }
          })
          groupId = newGroup.id
        }
        
        // Create monitor associations
        if (group.monitorList && group.monitorList.length > 0) {
          await tx.statusPageMonitor.createMany({
            data: group.monitorList.map(m => ({
              groupId: groupId,
              monitorId: m.id
            }))
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

// server/api/v1/status-pages/[slug]/monitors.get.ts
import { prisma } from '~/server/utils/prisma'

/**
 * Get monitors for a public status page with pagination support
 * This endpoint is public (no auth required)
 * 
 * Optimized for performance:
 * - Uses database-level pagination (skip/take) instead of loading all data
 * - Only loads necessary relations
 * - Separate count query for pagination metadata
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const query = getQuery(event)
  
  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug is required'
    })
  }

  // Parse query parameters (limit will be overridden by status page perPage setting)
  const groupFilter = query.group ? Number(query.group) : null
  const page = Math.max(1, Number(query.page) || 1)
  const queryLimit = query.limit ? Math.min(50, Math.max(1, Number(query.limit))) : null
  const noPagination = query.no_pagination === 'true' || query.no_pagination === '1'

  // First, get the status page basic info and check access
  const statusPage = await prisma.statusPage.findUnique({
    where: { slug },
    include: {
      incidents: {
        where: { pin: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }
  
  // Use status page perPage setting, or query limit, or default to 5
  const limit = queryLimit || statusPage.perPage || 5

  // Check if published (or authenticated for unpublished)
  if (!statusPage.published) {
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({
        statusCode: 404,
        message: 'Status page not found'
      })
    }
  }

  // Get all groups with monitor counts (lightweight query for tabs)
  const groupsWithCounts = await prisma.statusPageGroup.findMany({
    where: { statusPageId: statusPage.id },
    orderBy: { weight: 'asc' },
    select: {
      id: true,
      name: true,
      weight: true,
      _count: {
        select: { monitors: true }
      }
    }
  })

  // Build group tabs
  const groupTabs = groupsWithCounts.map(group => ({
    id: group.id,
    name: group.name,
    count: group._count.monitors
  }))

  // If no pagination, load all data (for edit mode)
  if (noPagination) {
    const allGroups = await prisma.statusPageGroup.findMany({
      where: { statusPageId: statusPage.id },
      orderBy: { weight: 'asc' },
      include: {
        monitors: {
          include: {
            monitor: {
              include: {
                tags: {
                  include: { tag: true }
                }
              }
            }
          }
        }
      }
    })

    const publicGroupList = allGroups.map(group => ({
      id: group.id,
      name: group.name,
      weight: group.weight,
      monitorList: group.monitors.map(spm => formatMonitor(spm, statusPage.showTags))
    }))

    return {
      ok: true,
      data: {
        config: formatConfig(statusPage),
        incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
        publicGroupList,
        groupTabs,
        pagination: null
      }
    }
  }

  // Determine target group for pagination
  const targetGroupId = groupFilter || groupsWithCounts[0]?.id

  if (!targetGroupId) {
    return {
      ok: true,
      data: {
        config: formatConfig(statusPage),
        incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
        publicGroupList: [],
        groupTabs,
        pagination: {
          total: 0,
          currentPage: page,
          totalPages: 0,
          perPage: limit,
          hasNextPage: false,
          hasPrevPage: false
        }
      }
    }
  }

  // Get target group info
  const targetGroup = groupsWithCounts.find(g => g.id === targetGroupId)
  if (!targetGroup) {
    return {
      ok: true,
      data: {
        config: formatConfig(statusPage),
        incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
        publicGroupList: [],
        groupTabs,
        pagination: {
          total: 0,
          currentPage: page,
          totalPages: 0,
          perPage: limit,
          hasNextPage: false,
          hasPrevPage: false
        }
      }
    }
  }

  // Database-level pagination - only fetch the monitors we need
  const offset = (page - 1) * limit
  const paginatedMonitors = await prisma.statusPageMonitor.findMany({
    where: { groupId: targetGroupId },
    skip: offset,
    take: limit,
    include: {
      monitor: {
        include: {
          tags: {
            include: { tag: true }
          }
        }
      }
    }
  })

  const totalMonitors = targetGroup._count.monitors
  const totalPages = Math.ceil(totalMonitors / limit)

  const publicGroupList = [{
    id: targetGroup.id,
    name: targetGroup.name,
    weight: targetGroup.weight,
    monitorList: paginatedMonitors.map(spm => formatMonitor(spm, statusPage.showTags))
  }]

  return {
    ok: true,
    data: {
      config: formatConfig(statusPage),
      incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
      publicGroupList,
      groupTabs,
      pagination: {
        total: totalMonitors,
        currentPage: page,
        totalPages,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  }
})

// Helper functions
function formatConfig(statusPage: any) {
  return {
    slug: statusPage.slug,
    title: statusPage.title,
    description: statusPage.description,
    icon: statusPage.icon || '/icon.svg',
    theme: statusPage.theme,
    published: statusPage.published,
    showTags: statusPage.showTags,
    showPoweredBy: statusPage.showPoweredBy,
    showCertificateExpiry: statusPage.showCertificateExpiry,
    perPage: statusPage.perPage || 5,
    autoRefreshInterval: statusPage.autoRefreshInterval || 300,
    customCSS: statusPage.customCss,
    footerText: statusPage.footerText,
    googleAnalyticsId: statusPage.googleAnalyticsId
  }
}

function formatIncident(incident: any) {
  return {
    id: incident.id,
    title: incident.title,
    content: incident.content,
    style: incident.style,
    pin: incident.pin,
    createdDate: incident.createdAt?.toISOString(),
    lastUpdatedDate: incident.updatedAt?.toISOString()
  }
}

function formatMonitor(spm: any, showTags: boolean) {
  const monitor = spm.monitor
  return {
    id: monitor.id,
    name: monitor.name,
    sendUrl: spm.sendUrl,
    url: monitor.url,
    type: monitor.type,
    tags: showTags && monitor.tags ? monitor.tags.map((mt: any) => ({
      id: mt.tag.id,
      name: mt.tag.name,
      color: mt.tag.color
    })) : []
  }
}

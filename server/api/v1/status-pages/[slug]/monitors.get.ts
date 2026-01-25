// server/api/v1/status-pages/[slug]/monitors.get.ts
import { prisma } from '~/server/utils/prisma'

/**
 * Get monitors for a public status page with pagination support
 * This endpoint is public (no auth required)
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

  // Parse query parameters
  const groupFilter = query.group ? Number(query.group) : null
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10))
  const noPagination = query.no_pagination === 'true' || query.no_pagination === '1'

  // Find status page
  const statusPage = await prisma.statusPage.findUnique({
    where: { slug },
    include: {
      groups: {
        orderBy: { weight: 'asc' },
        include: {
          monitors: {
            include: {
              monitor: {
                include: {
                  tags: {
                    include: {
                      tag: true
                    }
                  }
                }
              }
            }
          }
        }
      },
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

  // Build group tabs with monitor counts
  const groupTabs = statusPage.groups.map(group => ({
    id: group.id,
    name: group.name,
    count: group.monitors.length
  }))

  // If no pagination, return all data
  if (noPagination) {
    const publicGroupList = statusPage.groups.map(group => ({
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

  // Handle pagination
  let targetGroup = groupFilter
    ? statusPage.groups.find(g => g.id === groupFilter)
    : statusPage.groups[0]

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

  // Paginate monitors within the group
  const allMonitors = targetGroup.monitors
  const totalMonitors = allMonitors.length
  const totalPages = Math.ceil(totalMonitors / limit)
  const offset = (page - 1) * limit
  const paginatedMonitors = allMonitors.slice(offset, offset + limit)

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

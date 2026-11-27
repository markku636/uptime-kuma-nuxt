import { visibleStatusPage } from '../../../../utils/public-status'
import { getRequestSession } from '../../../../utils/request-session'
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
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 200) : ''
  const monitorFilter = (workspaceId: number) => ({
    workspaceId,
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  })

  const basicPage = await visibleStatusPage(event)
  // Overall status is computed from every monitor on the page, independent of
  // the current group/page/search so the banner cannot flicker while browsing.
  const linkedMonitors = await prisma.statusPageMonitor.findMany({
    where: { group: { statusPageId: basicPage.id } },
    select: { monitor: { select: { active: true, states: { select: { status: true }, take: 1 } } } },
    take: 4000,
  })
  const activeStatuses = linkedMonitors
    .filter(link => link.monitor.active)
    .map(link => link.monitor.states[0]?.status ?? 2)
  let pageOverallStatus = 'unknown'
  if (activeStatuses.length) {
    const down = activeStatuses.filter(status => status === 0).length
    const maintenance = activeStatuses.filter(status => status === 3).length
    if (down === activeStatuses.length) pageOverallStatus = 'major-outage'
    else if (down > 0) pageOverallStatus = 'partial-outage'
    else if (maintenance === activeStatuses.length) pageOverallStatus = 'maintenance'
    else if (activeStatuses.every(status => status === 1)) pageOverallStatus = 'operational'
  }

  const statusPage = { ...basicPage, incidents: await prisma.incident.findMany({ where: { statusPageId: basicPage.id, pin: true }, orderBy: { createdAt: 'desc' }, take: 20, include: { updates: { orderBy: { createdAt: 'asc' }, take: 50 } } }) }
  // Editing is a session capability; API keys never unlock the public editor.
  const session = await getRequestSession(event)
  let editAllowed = false
  if (session.user && event.context.authMethod === 'session') {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: statusPage.workspaceId, userId: session.user.id },
      select: { role: true },
    })
    editAllowed = session.user.platformAdmin || (!!member && ['editor', 'owner'].includes(member.role))
  }
  const limit = queryLimit || statusPage.perPage || 5
  if (noPagination) {
    const scope = await requireWorkspace(event, 'editor')
    if (scope.workspaceId !== statusPage.workspaceId) throw createError({ statusCode: 404, message: 'Status page not found' })
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

  // Group-level status for tabs, computed from all linked monitors (bounded).
  const groupLinks = await prisma.statusPageMonitor.findMany({
    where: { groupId: { in: groupsWithCounts.map(g => g.id) } },
    select: { groupId: true, monitor: { select: { active: true, states: { select: { status: true }, take: 1 } } } },
    take: 4000,
  })
  const groupStatus = new Map<number, string>()
  for (const group of groupsWithCounts) {
    const rows = groupLinks.filter(link => link.groupId === group.id && link.monitor.active)
    const statuses = rows.map(link => link.monitor.states[0]?.status ?? 2)
    let status = 'unknown'
    if (statuses.length) {
      if (statuses.includes(0)) status = 'down'
      else if (statuses.includes(3)) status = 'maintenance'
      else if (statuses.includes(2) || statuses.includes(1) === false) status = 'pending'
      else status = 'up'
    }
    groupStatus.set(group.id, status)
  }

  // Build group tabs
  const groupTabs = groupsWithCounts.map(group => ({
    id: group.id,
    name: group.name,
    count: group._count.monitors,
    status: groupStatus.get(group.id) || 'unknown',
  }))

  // If no pagination, load all data (for edit mode)
  if (noPagination) {
    const allGroups = await prisma.statusPageGroup.findMany({
      where: { statusPageId: statusPage.id },
      take: 100,
      orderBy: { weight: 'asc' },
      include: {
        monitors: {
          where: { monitor: { workspaceId: statusPage.workspaceId } },
          take: 4000,
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
        config: { ...formatConfig(statusPage, editAllowed), overallStatus: pageOverallStatus },
        incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
        incidents: statusPage.incidents.map(formatIncident),
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
        config: { ...formatConfig(statusPage, editAllowed), overallStatus: pageOverallStatus },
        incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
        incidents: statusPage.incidents.map(formatIncident),
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
        config: { ...formatConfig(statusPage, editAllowed), overallStatus: pageOverallStatus },
        incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
        incidents: statusPage.incidents.map(formatIncident),
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
    where: { groupId: targetGroupId, monitor: monitorFilter(statusPage.workspaceId) },
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

  const totalMonitors = search
    ? await prisma.statusPageMonitor.count({ where: { groupId: targetGroupId, monitor: monitorFilter(statusPage.workspaceId) } })
    : targetGroup._count.monitors
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
      config: { ...formatConfig(statusPage, editAllowed), overallStatus: pageOverallStatus },
      incident: statusPage.incidents[0] ? formatIncident(statusPage.incidents[0]) : null,
        incidents: statusPage.incidents.map(formatIncident),
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
function formatConfig(statusPage: any, canEdit = false) {
  return {
    slug: statusPage.slug,
    canEdit,
    title: statusPage.title,
    description: statusPage.description,
    icon: statusPage.icon || '/sealwatch-mascot.png',
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
    lastUpdatedDate: incident.updatedAt?.toISOString(),
    updates: (incident.updates || []).map((update: any) => ({
      id: update.id,
      status: update.status,
      message: update.message,
      createdDate: update.createdAt?.toISOString(),
    })),
  }
}

function formatMonitor(spm: any, showTags: boolean) {
  const monitor = spm.monitor
  return {
    id: monitor.id,
    name: monitor.name,
    sendUrl: spm.sendUrl,
    // Only expose the target URL when the status page owner opted in.
    ...(spm.sendUrl && ['http', 'keyword', 'json-query'].includes(monitor.type) && monitor.url
      ? { url: monitor.url }
      : {}),

    type: monitor.type,
    tags: showTags && monitor.tags ? monitor.tags.map((mt: any) => ({
      id: mt.tag.id,
      name: mt.tag.name,
      color: mt.tag.color
    })) : []
  }
}

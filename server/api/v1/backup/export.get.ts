import { prisma } from '~/server/utils/prisma'



export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = (session.user as { id: number }).id
  
  // Fetch all user data for export
  const [monitors, notifications, statusPages, maintenances, proxies, dockerHosts, tags, workspaces] = await Promise.all([
    prisma.monitor.findMany({
      where: { userId: userId },
      include: {
        tags: { select: { tagId: true } },
        monitorNotifications: { select: { notificationId: true } }
      }
    }),
    prisma.notification.findMany({
      where: { userId: userId }
    }),
    prisma.statusPage.findMany({
      where: { userId: userId },
      include: {
        groups: { include: { monitors: { select: { monitorId: true } } } }
      }
    }),
    prisma.maintenance.findMany({
      where: { userId: userId },
      include: {
        monitors: { select: { monitorId: true } },
        statusPages: { select: { statusPageId: true } }
      }
    }),
    prisma.proxy.findMany({
      where: { userId: userId }
    }),
    prisma.dockerHost.findMany({
      where: { userId: userId }
    }),
    prisma.tag.findMany({
      where: { userId: userId }
    }),
    prisma.workspace.findMany({
      where: { userId: userId },
      orderBy: [{ weight: 'asc' }, { id: 'asc' }]
    })
  ])

  // Create backup object
  const backup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {
      monitors: monitors.map(m => ({
        ...m,
        tagIds: m.tags.map(t => t.tagId),
        notificationIds: m.monitorNotifications.map(n => n.notificationId)
      })),
      notifications,
      statusPages: statusPages.map(sp => ({
        ...sp,
        monitorIds: sp.groups.flatMap(g => g.monitors.map(m => m.monitorId))
      })),
      maintenances: maintenances.map(mt => ({
        ...mt,
        monitorIds: mt.monitors.map(m => m.monitorId),
        statusPageIds: mt.statusPages.map(s => s.statusPageId)
      })),
      proxies,
      dockerHosts,
      tags,
      workspaces
    }
  }

  return backup
})

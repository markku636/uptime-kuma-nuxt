import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  
  // Fetch all user data for export
  const [monitors, notifications, statusPages, maintenances, proxies, dockerHosts, tags] = await Promise.all([
    prisma.monitor.findMany({
      where: { userId: session.user.id },
      include: {
        tags: true,
        notifications: true
      }
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id }
    }),
    prisma.statusPage.findMany({
      where: { userId: session.user.id },
      include: {
        monitors: {
          select: { id: true }
        }
      }
    }),
    prisma.maintenance.findMany({
      where: { userId: session.user.id },
      include: {
        monitors: {
          select: { id: true }
        }
      }
    }),
    prisma.proxy.findMany({
      where: { userId: session.user.id }
    }),
    prisma.dockerHost.findMany({
      where: { userId: session.user.id }
    }),
    prisma.tag.findMany({
      where: { userId: session.user.id }
    })
  ])

  // Create backup object
  const backup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {
      monitors: monitors.map(m => ({
        ...m,
        tagIds: m.tags.map(t => t.id),
        notificationIds: m.notifications.map(n => n.id)
      })),
      notifications,
      statusPages: statusPages.map(sp => ({
        ...sp,
        monitorIds: sp.monitors.map(m => m.id)
      })),
      maintenances: maintenances.map(mt => ({
        ...mt,
        monitorIds: mt.monitors.map(m => m.id)
      })),
      proxies,
      dockerHosts,
      tags
    }
  }

  return backup
})

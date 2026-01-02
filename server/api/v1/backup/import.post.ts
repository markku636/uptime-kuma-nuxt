import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const importOptionsSchema = z.object({
  overwrite: z.boolean().default(false),
  importMonitors: z.boolean().default(true),
  importNotifications: z.boolean().default(true),
  importStatusPages: z.boolean().default(true),
  importMaintenances: z.boolean().default(true),
  importProxies: z.boolean().default(true),
  importDockerHosts: z.boolean().default(true)
})

const importSchema = z.object({
  data: z.object({
    version: z.string().optional(),
    exportedAt: z.string().optional(),
    data: z.object({
      monitors: z.array(z.any()).optional(),
      notifications: z.array(z.any()).optional(),
      statusPages: z.array(z.any()).optional(),
      maintenances: z.array(z.any()).optional(),
      proxies: z.array(z.any()).optional(),
      dockerHosts: z.array(z.any()).optional(),
      tags: z.array(z.any()).optional()
    })
  }),
  options: importOptionsSchema
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)

  const { data, options } = importSchema.parse(body)
  const backupData = data.data

  const results = {
    monitors: { imported: 0, skipped: 0 },
    notifications: { imported: 0, skipped: 0 },
    statusPages: { imported: 0, skipped: 0 },
    maintenances: { imported: 0, skipped: 0 },
    proxies: { imported: 0, skipped: 0 },
    dockerHosts: { imported: 0, skipped: 0 },
    tags: { imported: 0, skipped: 0 }
  }

  // Import tags first (they may be referenced by monitors)
  if (backupData.tags && backupData.tags.length > 0) {
    for (const tag of backupData.tags) {
      try {
        const existingTag = await prisma.tag.findFirst({
          where: {
            userId: session.user.id,
            name: tag.name
          }
        })

        if (existingTag && !options.overwrite) {
          results.tags.skipped++
          continue
        }

        if (existingTag && options.overwrite) {
          await prisma.tag.update({
            where: { id: existingTag.id },
            data: {
              color: tag.color
            }
          })
        } else {
          await prisma.tag.create({
            data: {
              name: tag.name,
              color: tag.color,
              userId: session.user.id
            }
          })
        }
        results.tags.imported++
      } catch (error) {
        results.tags.skipped++
      }
    }
  }

  // Import notifications
  if (options.importNotifications && backupData.notifications) {
    for (const notification of backupData.notifications) {
      try {
        const existing = await prisma.notification.findFirst({
          where: {
            userId: session.user.id,
            name: notification.name
          }
        })

        if (existing && !options.overwrite) {
          results.notifications.skipped++
          continue
        }

        const notificationData = {
          name: notification.name,
          type: notification.type,
          config: notification.config,
          isDefault: notification.isDefault,
          active: notification.active,
          userId: session.user.id
        }

        if (existing && options.overwrite) {
          await prisma.notification.update({
            where: { id: existing.id },
            data: notificationData
          })
        } else {
          await prisma.notification.create({
            data: notificationData
          })
        }
        results.notifications.imported++
      } catch (error) {
        results.notifications.skipped++
      }
    }
  }

  // Import proxies
  if (options.importProxies && backupData.proxies) {
    for (const proxy of backupData.proxies) {
      try {
        const existing = await prisma.proxy.findFirst({
          where: {
            userId: session.user.id,
            host: proxy.host,
            port: proxy.port
          }
        })

        if (existing && !options.overwrite) {
          results.proxies.skipped++
          continue
        }

        const proxyData = {
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port,
          auth: proxy.auth,
          username: proxy.username,
          active: proxy.active,
          isDefault: proxy.isDefault,
          userId: session.user.id
        }

        if (existing && options.overwrite) {
          await prisma.proxy.update({
            where: { id: existing.id },
            data: proxyData
          })
        } else {
          await prisma.proxy.create({
            data: proxyData
          })
        }
        results.proxies.imported++
      } catch (error) {
        results.proxies.skipped++
      }
    }
  }

  // Import Docker hosts
  if (options.importDockerHosts && backupData.dockerHosts) {
    for (const dockerHost of backupData.dockerHosts) {
      try {
        const existing = await prisma.dockerHost.findFirst({
          where: {
            userId: session.user.id,
            name: dockerHost.name
          }
        })

        if (existing && !options.overwrite) {
          results.dockerHosts.skipped++
          continue
        }

        const dockerHostData = {
          name: dockerHost.name,
          dockerType: dockerHost.dockerType,
          dockerDaemon: dockerHost.dockerDaemon,
          connectionUrl: dockerHost.connectionUrl,
          active: dockerHost.active,
          userId: session.user.id
        }

        if (existing && options.overwrite) {
          await prisma.dockerHost.update({
            where: { id: existing.id },
            data: dockerHostData
          })
        } else {
          await prisma.dockerHost.create({
            data: dockerHostData
          })
        }
        results.dockerHosts.imported++
      } catch (error) {
        results.dockerHosts.skipped++
      }
    }
  }

  // Import monitors
  if (options.importMonitors && backupData.monitors) {
    for (const monitor of backupData.monitors) {
      try {
        const existing = await prisma.monitor.findFirst({
          where: {
            userId: session.user.id,
            name: monitor.name
          }
        })

        if (existing && !options.overwrite) {
          results.monitors.skipped++
          continue
        }

        // Exclude relationship fields
        const { id, tags, notifications, tagIds, notificationIds, userId, ...monitorData } = monitor

        if (existing && options.overwrite) {
          await prisma.monitor.update({
            where: { id: existing.id },
            data: {
              ...monitorData,
              userId: session.user.id
            }
          })
        } else {
          await prisma.monitor.create({
            data: {
              ...monitorData,
              userId: session.user.id
            }
          })
        }
        results.monitors.imported++
      } catch (error) {
        results.monitors.skipped++
      }
    }
  }

  // Import status pages
  if (options.importStatusPages && backupData.statusPages) {
    for (const statusPage of backupData.statusPages) {
      try {
        const existing = await prisma.statusPage.findFirst({
          where: {
            userId: session.user.id,
            slug: statusPage.slug
          }
        })

        if (existing && !options.overwrite) {
          results.statusPages.skipped++
          continue
        }

        const { id, monitors, monitorIds, userId, ...statusPageData } = statusPage

        if (existing && options.overwrite) {
          await prisma.statusPage.update({
            where: { id: existing.id },
            data: {
              ...statusPageData,
              userId: session.user.id
            }
          })
        } else {
          await prisma.statusPage.create({
            data: {
              ...statusPageData,
              userId: session.user.id
            }
          })
        }
        results.statusPages.imported++
      } catch (error) {
        results.statusPages.skipped++
      }
    }
  }

  // Import maintenances
  if (options.importMaintenances && backupData.maintenances) {
    for (const maintenance of backupData.maintenances) {
      try {
        const existing = await prisma.maintenance.findFirst({
          where: {
            userId: session.user.id,
            title: maintenance.title
          }
        })

        if (existing && !options.overwrite) {
          results.maintenances.skipped++
          continue
        }

        const { id, monitors, monitorIds, userId, ...maintenanceData } = maintenance

        if (existing && options.overwrite) {
          await prisma.maintenance.update({
            where: { id: existing.id },
            data: {
              ...maintenanceData,
              userId: session.user.id
            }
          })
        } else {
          await prisma.maintenance.create({
            data: {
              ...maintenanceData,
              userId: session.user.id
            }
          })
        }
        results.maintenances.imported++
      } catch (error) {
        results.maintenances.skipped++
      }
    }
  }

  return {
    success: true,
    results
  }
})

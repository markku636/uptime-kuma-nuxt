import { prisma } from '~/server/utils/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prepareMonitor, resolveParents, type IdMap } from '~/server/services/backup/monitor-import'
import { startMonitorJob } from '~/server/services/monitor/scheduler'



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
      tags: z.array(z.any()).optional(),
      workspaces: z.array(z.any()).optional()
    })
  }),
  options: importOptionsSchema
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = (session.user as { id: number }).id
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
    tags: { imported: 0, skipped: 0 },
    workspaces: { imported: 0, skipped: 0 }
  }

  // Ids in the backup belong to the source database: old id -> id here
  const tagMap: IdMap = new Map()
  const notificationMap: IdMap = new Map()
  const proxyMap: IdMap = new Map()
  const workspaceMap: IdMap = new Map()

  // Import tags first (they may be referenced by monitors)
  if (backupData.tags && backupData.tags.length > 0) {
    for (const tag of backupData.tags) {
      try {
        const existingTag = await prisma.tag.findFirst({
          where: {
            userId: userId,
            name: tag.name
          }
        })

        if (existingTag) tagMap.set(tag.id, existingTag.id)
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
          const created = await prisma.tag.create({
            data: {
              name: tag.name,
              color: tag.color,
              userId: userId
            }
          })
          tagMap.set(tag.id, created.id)
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
            userId: userId,
            name: notification.name
          }
        })

        if (existing) notificationMap.set(notification.id, existing.id)
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
          userId: userId
        }

        if (existing && options.overwrite) {
          await prisma.notification.update({
            where: { id: existing.id },
            data: notificationData
          })
        } else {
          const created = await prisma.notification.create({
            data: notificationData
          })
          notificationMap.set(notification.id, created.id)
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
            userId: userId,
            host: proxy.host,
            port: proxy.port
          }
        })

        if (existing) proxyMap.set(proxy.id, existing.id)
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
          userId: userId
        }

        if (existing && options.overwrite) {
          await prisma.proxy.update({
            where: { id: existing.id },
            data: proxyData
          })
        } else {
          const created = await prisma.proxy.create({
            data: proxyData
          })
          proxyMap.set(proxy.id, created.id)
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
            userId: userId,
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
          userId: userId
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

  // Import workspaces (matched by name)
  if (options.importMonitors && backupData.workspaces) {
    for (const workspace of backupData.workspaces) {
      try {
        if (!workspace?.name) throw new Error('Workspace without a name')
        const existing = await prisma.workspace.findFirst({ where: { userId: userId, name: workspace.name } })
        const data = {
          name: workspace.name,
          description: workspace.description ?? null,
          color: /^#[0-9a-fA-F]{6}$/.test(workspace.color) ? workspace.color : undefined,
          weight: Number.isInteger(workspace.weight) ? workspace.weight : undefined,
        }
        if (existing) {
          workspaceMap.set(workspace.id, existing.id)
          if (!options.overwrite) {
            results.workspaces.skipped++
            continue
          }
          await prisma.workspace.update({ where: { id: existing.id }, data })
        } else {
          const created = await prisma.workspace.create({ data: { ...data, userId: userId } })
          workspaceMap.set(workspace.id, created.id)
        }
        results.workspaces.imported++
      } catch (error) {
        console.error('[Backup] Workspace import failed:', workspace?.name, error)
        results.workspaces.skipped++
      }
    }
  }

  // Import monitors (matched by name). References are remapped to ids in this
  // database; group membership is restored in a second pass once every
  // monitor exists, because a member can come before its group in the file.
  if (options.importMonitors && backupData.monitors) {
    const scalarFields = Object.values(Prisma.MonitorScalarFieldEnum)
    const maps = { workspaces: workspaceMap, proxies: proxyMap, tags: tagMap, notifications: notificationMap }
    const monitorMap: IdMap = new Map()
    const oldParents = new Map<number, number | null>()
    const importedIds: number[] = []

    for (const monitor of backupData.monitors) {
      try {
        if (!monitor?.name || !monitor?.type) throw new Error('Monitor without a name or type')
        const existing = await prisma.monitor.findFirst({
          where: { userId: userId, name: monitor.name }
        })

        if (existing && !options.overwrite) {
          monitorMap.set(monitor.id, existing.id)
          results.monitors.skipped++
          continue
        }

        const prepared = prepareMonitor(monitor, scalarFields, maps)
        const data = { ...prepared.data, userId: userId } as Prisma.MonitorUncheckedCreateInput

        let saved
        if (existing) {
          // A push token belongs to one monitor: keep the current one
          const { pushToken, ...update } = data
          saved = await prisma.monitor.update({ where: { id: existing.id }, data: update })
          await prisma.monitorTag.deleteMany({ where: { monitorId: saved.id } })
          await prisma.monitorNotification.deleteMany({ where: { monitorId: saved.id } })
        } else {
          const tokenTaken = data.pushToken
            ? await prisma.monitor.findFirst({ where: { pushToken: data.pushToken }, select: { id: true } })
            : null
          saved = await prisma.monitor.create({ data: tokenTaken ? { ...data, pushToken: null } : data })
        }

        monitorMap.set(monitor.id, saved.id)
        oldParents.set(saved.id, prepared.oldParent)
        importedIds.push(saved.id)

        if (prepared.tagIds.length) {
          await prisma.monitorTag.createMany({
            data: prepared.tagIds.map(tagId => ({ monitorId: saved.id, tagId })),
            skipDuplicates: true
          })
        }
        if (prepared.notificationIds.length) {
          await prisma.monitorNotification.createMany({
            data: prepared.notificationIds.map(notificationId => ({ monitorId: saved.id, notificationId })),
            skipDuplicates: true
          })
        }
        results.monitors.imported++
      } catch (error) {
        console.error('[Backup] Monitor import failed:', monitor?.name, error)
        results.monitors.skipped++
      }
    }

    // Second pass: group membership. A member always lives in its group's workspace.
    for (const [id, parent] of resolveParents(oldParents, monitorMap)) {
      if (parent == null) continue
      const group = await prisma.monitor.findFirst({
        where: { id: parent, userId: userId, type: 'group' },
        select: { workspaceId: true }
      })
      if (group) await prisma.monitor.update({ where: { id }, data: { parent, workspaceId: group.workspaceId } })
    }

    // Start checking what was imported
    const toStart = await prisma.monitor.findMany({ where: { id: { in: importedIds }, active: true } })
    for (const monitor of toStart) startMonitorJob(monitor)
  }

  // Import status pages
  if (options.importStatusPages && backupData.statusPages) {
    for (const statusPage of backupData.statusPages) {
      try {
        const existing = await prisma.statusPage.findFirst({
          where: {
            userId: userId,
            slug: statusPage.slug
          }
        })

        if (existing && !options.overwrite) {
          results.statusPages.skipped++
          continue
        }

        const { id, monitors, monitorIds, userId: _sourceUserId, ...statusPageData } = statusPage

        if (existing && options.overwrite) {
          await prisma.statusPage.update({
            where: { id: existing.id },
            data: {
              ...statusPageData,
              userId: userId
            }
          })
        } else {
          await prisma.statusPage.create({
            data: {
              ...statusPageData,
              userId: userId
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
            userId: userId,
            title: maintenance.title
          }
        })

        if (existing && !options.overwrite) {
          results.maintenances.skipped++
          continue
        }

        const { id, monitors, monitorIds, userId: _sourceUserId, ...maintenanceData } = maintenance

        if (existing && options.overwrite) {
          await prisma.maintenance.update({
            where: { id: existing.id },
            data: {
              ...maintenanceData,
              userId: userId
            }
          })
        } else {
          await prisma.maintenance.create({
            data: {
              ...maintenanceData,
              userId: userId
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

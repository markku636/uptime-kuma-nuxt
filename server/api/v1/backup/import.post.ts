import { prisma } from '~/server/utils/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { pickScalars, prepareMonitor, remapIds, resolveParents, type IdMap } from '~/server/services/backup/monitor-import'
import { startMonitorJob, stopMonitorJob } from '~/server/services/monitor/scheduler'
import { normalizeWorkspaces } from '~/server/services/workspace/service'
import { wouldCreateCycle } from '~/server/services/workspace/tree'
import { invalidateVariables } from '~/server/services/variables/service'
import { VARIABLE_NAME } from '~/server/services/variables/resolve'
import { startMaintenanceJob } from '~/server/services/maintenance/scheduler'



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
      workspaces: z.array(z.any()).optional(),
      variables: z.array(z.any()).optional()
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
    workspaces: { imported: 0, skipped: 0 },
    variables: { imported: 0, skipped: 0 }
  }

  // Ids in the backup belong to the source database: old id -> id here
  const tagMap: IdMap = new Map()
  const notificationMap: IdMap = new Map()
  const proxyMap: IdMap = new Map()
  const workspaceMap: IdMap = new Map()
  const monitorMap: IdMap = new Map()

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

  // Import variables (matched by scope and name) after workspaces, before monitors use them
  if (options.importMonitors && backupData.variables) {
    for (const variable of backupData.variables) {
      try {
        const name = String(variable?.name ?? '')
        if (!VARIABLE_NAME.test(name)) throw new Error('Invalid variable name')
        // A variable of a workspace that was not restored is skipped, never made global
        let workspaceId: number | null = null
        if (variable.workspaceId != null) {
          const mapped = workspaceMap.get(Number(variable.workspaceId))
          if (mapped == null) throw new Error('Workspace not restored')
          workspaceId = mapped
        }
        const data = { value: String(variable.value ?? ''), secret: !!variable.secret }
        const existing = await prisma.variable.findFirst({ where: { userId, workspaceId, name } })
        if (existing && !options.overwrite) {
          results.variables.skipped++
          continue
        }
        if (existing) await prisma.variable.update({ where: { id: existing.id }, data })
        else await prisma.variable.create({ data: { ...data, name, workspaceId, userId } })
        results.variables.imported++
      } catch (error) {
        console.error('[Backup] Variable import failed:', variable?.name, error)
        results.variables.skipped++
      }
    }
    invalidateVariables(userId)
  }

  // Import monitors (matched by name). References are remapped to ids in this
  // database; group membership is restored in a second pass once every
  // monitor exists, because a member can come before its group in the file.
  if (options.importMonitors && backupData.monitors) {
    const scalarFields = Object.values(Prisma.MonitorScalarFieldEnum)
    const maps = { workspaces: workspaceMap, proxies: proxyMap, tags: tagMap, notifications: notificationMap }
    const oldParents = new Map<number, number | null>()
    const oldPausedBy = new Map<number, number>()
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
        if (prepared.oldPausedByGroup != null) oldPausedBy.set(saved.id, prepared.oldPausedByGroup)
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

    // Second pass: group membership, checked against the tree as it is now
    // so a hand-edited or legacy backup cannot create a cycle (A > B > A)
    const tree = await prisma.monitor.findMany({ where: { userId }, select: { id: true, parent: true, type: true } })
    const groupIds = new Set(tree.filter(m => m.type === 'group').map(m => m.id))
    for (const [id, parent] of resolveParents(oldParents, monitorMap)) {
      if (parent == null || !groupIds.has(parent) || wouldCreateCycle(tree, id, parent)) continue
      await prisma.monitor.update({ where: { id }, data: { parent } })
      const node = tree.find(m => m.id === id)
      if (node) node.parent = parent
    }
    // "Paused by group" points at a group of the backup: translate it as well
    for (const [id, oldGroup] of oldPausedBy) {
      const groupId = monitorMap.get(oldGroup)
      if (groupId != null && groupIds.has(groupId)) await prisma.monitor.update({ where: { id }, data: { pausedByGroup: groupId } })
    }

    // A member always lives in its group's workspace, whatever order the rows came in
    await normalizeWorkspaces(userId)

    // Run what is active, and stop the old check of a monitor the backup marks paused
    const restored = await prisma.monitor.findMany({ where: { id: { in: importedIds } } })
    for (const monitor of restored) {
      if (monitor.active) startMonitorJob(monitor)
      else stopMonitorJob(monitor.id)
    }
  }

  // Monitors that were not imported (option off, or failed) may already exist here: match them by name
  for (const monitor of backupData.monitors ?? []) {
    if (monitor?.id == null || monitorMap.has(monitor.id) || !monitor.name) continue
    const existing = await prisma.monitor.findFirst({ where: { userId, name: monitor.name }, select: { id: true } })
    if (existing) monitorMap.set(monitor.id, existing.id)
  }

  // Import status pages (matched by slug), with their groups and monitors
  const statusPageMap: IdMap = new Map()
  if (options.importStatusPages && backupData.statusPages) {
    const scalarFields = Object.values(Prisma.StatusPageScalarFieldEnum)
    for (const statusPage of backupData.statusPages) {
      try {
        if (!statusPage?.slug || !statusPage?.title) throw new Error('Status page without a slug or title')
        const existing = await prisma.statusPage.findFirst({
          where: { slug: statusPage.slug }
        })

        if (existing && existing.userId !== userId) throw new Error(`Slug "${statusPage.slug}" is used by another user`)
        if (existing) statusPageMap.set(statusPage.id, existing.id)
        if (existing && !options.overwrite) {
          results.statusPages.skipped++
          continue
        }

        const data = pickScalars(statusPage, scalarFields) as Prisma.StatusPageUncheckedCreateInput
        const saved = existing
          ? await prisma.statusPage.update({ where: { id: existing.id }, data })
          : await prisma.statusPage.create({ data: { ...data, userId } })
        statusPageMap.set(statusPage.id, saved.id)

        // Groups: exported as `groups: [{ name, weight, monitors: [{ monitorId }] }]`
        if (Array.isArray(statusPage.groups)) {
          await prisma.statusPageGroup.deleteMany({ where: { statusPageId: saved.id } })
          for (const [index, group] of statusPage.groups.entries()) {
            const created = await prisma.statusPageGroup.create({
              data: {
                statusPageId: saved.id,
                name: typeof group?.name === 'string' ? group.name : 'Services',
                // Exported in display order; ties in old data must not reorder them
                weight: index + 1,
              }
            })
            const rows = (Array.isArray(group?.monitors) ? group.monitors : [])
              .map((m: any) => ({ monitorId: monitorMap.get(Number(m?.monitorId)), sendUrl: !!m?.sendUrl }))
              .filter((m: { monitorId?: number }) => m.monitorId != null)
            if (rows.length) {
              await prisma.statusPageMonitor.createMany({
                data: rows.map((m: { monitorId: number; sendUrl: boolean }) => ({ groupId: created.id, monitorId: m.monitorId, sendUrl: m.sendUrl }))
              })
            }
          }
        }
        results.statusPages.imported++
      } catch (error) {
        console.error('[Backup] Status page import failed:', statusPage?.slug, error)
        results.statusPages.skipped++
      }
    }
  }

  // Status pages that were not imported may already exist here: match them by slug
  for (const statusPage of backupData.statusPages ?? []) {
    if (statusPage?.id == null || statusPageMap.has(statusPage.id) || !statusPage.slug) continue
    const existing = await prisma.statusPage.findFirst({ where: { userId, slug: statusPage.slug }, select: { id: true } })
    if (existing) statusPageMap.set(statusPage.id, existing.id)
  }

  // Import maintenances (matched by title), with their monitors and status pages
  if (options.importMaintenances && backupData.maintenances) {
    const scalarFields = Object.values(Prisma.MaintenanceScalarFieldEnum)
    for (const maintenance of backupData.maintenances) {
      try {
        if (!maintenance?.title) throw new Error('Maintenance without a title')
        const existing = await prisma.maintenance.findFirst({
          where: { userId, title: maintenance.title }
        })

        if (existing && !options.overwrite) {
          results.maintenances.skipped++
          continue
        }

        const data = pickScalars(maintenance, scalarFields) as Prisma.MaintenanceUncheckedCreateInput
        const saved = existing
          ? await prisma.maintenance.update({ where: { id: existing.id }, data })
          : await prisma.maintenance.create({ data: { ...data, userId } })

        const monitorIds = remapIds(maintenance.monitorIds ?? (maintenance.monitors ?? []).map((m: any) => m?.monitorId), monitorMap)
        const statusPageIds = remapIds(maintenance.statusPageIds ?? (maintenance.statusPages ?? []).map((s: any) => s?.statusPageId), statusPageMap)
        await prisma.maintenanceMonitor.deleteMany({ where: { maintenanceId: saved.id } })
        await prisma.maintenanceStatusPage.deleteMany({ where: { maintenanceId: saved.id } })
        if (monitorIds.length) {
          await prisma.maintenanceMonitor.createMany({ data: monitorIds.map(monitorId => ({ maintenanceId: saved.id, monitorId })) })
        }
        if (statusPageIds.length) {
          await prisma.maintenanceStatusPage.createMany({ data: statusPageIds.map(statusPageId => ({ maintenanceId: saved.id, statusPageId })) })
        }

        // Schedule its windows like a maintenance created in the app
        await startMaintenanceJob(saved)
        results.maintenances.imported++
      } catch (error) {
        console.error('[Backup] Maintenance import failed:', maintenance?.title, error)
        results.maintenances.skipped++
      }
    }
  }

  return {
    success: true,
    results
  }
})

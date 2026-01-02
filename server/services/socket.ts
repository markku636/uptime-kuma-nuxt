// server/services/socket.ts
// WebSocket service for real-time communication
import { Server as HTTPServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import { PrismaClient, Prisma } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

let io: SocketServer | null = null

interface AuthenticatedSocket extends Socket {
  userId?: number
  username?: string
}

// Helper function to generate random ID
function generateId(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length)
}

// Socket event handlers
const socketHandlers = {
  // Monitor events
  async getMonitorList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const monitors = await prisma.monitor.findMany({
        where: { userId: socket.userId },
        include: {
          tags: { include: { tag: true } }
        },
        orderBy: { name: 'asc' }
      })

      callback({ ok: true, monitors })
      
      // Also emit latest heartbeats for each monitor
      for (const monitor of monitors) {
        const heartbeats = await prisma.heartbeat.findMany({
          where: { monitorId: monitor.id },
          orderBy: { time: 'desc' },
          take: 100
        })
        socket.emit('heartbeatList', { monitorId: monitor.id, heartbeats, overwrite: true })
      }
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async getMonitor(socket: AuthenticatedSocket, monitorId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const monitor = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId },
        include: {
          tags: { include: { tag: true } },
          monitorNotifications: { include: { notification: true } }
        }
      })

      if (!monitor) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      callback({ ok: true, monitor })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async getMonitorBeats(socket: AuthenticatedSocket, monitorId: number, period: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Check ownership
      const monitor = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId }
      })

      if (!monitor) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      const since = new Date(Date.now() - period * 60 * 60 * 1000) // period in hours
      
      const heartbeats = await prisma.heartbeat.findMany({
        where: {
          monitorId,
          time: { gte: since }
        },
        orderBy: { time: 'desc' }
      })

      callback({ ok: true, data: heartbeats })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // Notification events
  async getNotificationList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: socket.userId },
        orderBy: { name: 'asc' }
      })

      callback({ ok: true, notifications })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // Tags events
  async getTags(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const tags = await prisma.tag.findMany({
        where: { userId: socket.userId },
        orderBy: { name: 'asc' }
      })

      callback({ ok: true, tags })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // Status page events
  async getStatusPageList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const statusPages = await prisma.statusPage.findMany({
        where: { userId: socket.userId },
        orderBy: { title: 'asc' }
      })

      callback({ ok: true, statusPages })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // Maintenance events
  async getMaintenanceList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const maintenances = await prisma.maintenance.findMany({
        where: { userId: socket.userId },
        orderBy: { createdAt: 'desc' }
      })

      callback({ ok: true, maintenances })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Maintenance CRUD Events
  // =====================
  async getMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const maintenance = await prisma.maintenance.findFirst({
        where: { id: maintenanceId, userId: socket.userId },
        include: {
          monitors: { include: { monitor: true } },
          statusPages: { include: { statusPage: true } }
        }
      })

      if (!maintenance) {
        return callback({ ok: false, msg: 'Maintenance not found' })
      }

      callback({ ok: true, maintenance })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async addMaintenance(socket: AuthenticatedSocket, maintenance: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const newMaintenance = await prisma.maintenance.create({
        data: {
          userId: socket.userId,
          title: maintenance.title,
          description: maintenance.description || null,
          strategy: maintenance.strategy || 'manual',
          active: maintenance.active ?? true,
          dateRange: maintenance.dateRange ? JSON.stringify(maintenance.dateRange) : null,
          intervalDay: maintenance.intervalDay || 1,
          weekdays: maintenance.weekdays ? JSON.stringify(maintenance.weekdays) : null,
          daysOfMonth: maintenance.daysOfMonth ? JSON.stringify(maintenance.daysOfMonth) : null,
          timeRange: maintenance.timeRange ? JSON.stringify(maintenance.timeRange) : null,
          cron: maintenance.cron || null,
          duration: maintenance.duration || 60,
          timezoneOption: maintenance.timezoneOption || null,
          timezoneOffset: maintenance.timezoneOffset || null
        }
      })

      // Add monitor associations
      if (maintenance.monitors && maintenance.monitors.length > 0) {
        await prisma.maintenanceMonitor.createMany({
          data: maintenance.monitors.map((monitorId: number) => ({
            maintenanceId: newMaintenance.id,
            monitorId
          }))
        })
      }

      // Add status page associations
      if (maintenance.statusPages && maintenance.statusPages.length > 0) {
        await prisma.maintenanceStatusPage.createMany({
          data: maintenance.statusPages.map((statusPageId: number) => ({
            maintenanceId: newMaintenance.id,
            statusPageId
          }))
        })
      }

      callback({ ok: true, maintenance: newMaintenance })

      // Broadcast to user's sockets
      broadcastMaintenanceAdded(socket.userId, newMaintenance)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async editMaintenance(socket: AuthenticatedSocket, maintenance: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Check ownership
      const existing = await prisma.maintenance.findFirst({
        where: { id: maintenance.id, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Maintenance not found' })
      }

      const updated = await prisma.maintenance.update({
        where: { id: maintenance.id },
        data: {
          title: maintenance.title,
          description: maintenance.description || null,
          strategy: maintenance.strategy || 'manual',
          active: maintenance.active ?? true,
          dateRange: maintenance.dateRange ? JSON.stringify(maintenance.dateRange) : null,
          intervalDay: maintenance.intervalDay || 1,
          weekdays: maintenance.weekdays ? JSON.stringify(maintenance.weekdays) : null,
          daysOfMonth: maintenance.daysOfMonth ? JSON.stringify(maintenance.daysOfMonth) : null,
          timeRange: maintenance.timeRange ? JSON.stringify(maintenance.timeRange) : null,
          cron: maintenance.cron || null,
          duration: maintenance.duration || 60,
          timezoneOption: maintenance.timezoneOption || null,
          timezoneOffset: maintenance.timezoneOffset || null
        }
      })

      // Update monitor associations
      await prisma.maintenanceMonitor.deleteMany({ where: { maintenanceId: maintenance.id } })
      if (maintenance.monitors && maintenance.monitors.length > 0) {
        await prisma.maintenanceMonitor.createMany({
          data: maintenance.monitors.map((monitorId: number) => ({
            maintenanceId: maintenance.id,
            monitorId
          }))
        })
      }

      // Update status page associations
      await prisma.maintenanceStatusPage.deleteMany({ where: { maintenanceId: maintenance.id } })
      if (maintenance.statusPages && maintenance.statusPages.length > 0) {
        await prisma.maintenanceStatusPage.createMany({
          data: maintenance.statusPages.map((statusPageId: number) => ({
            maintenanceId: maintenance.id,
            statusPageId
          }))
        })
      }

      callback({ ok: true, maintenance: updated })

      // Broadcast update
      broadcastMaintenanceUpdated(socket.userId, updated)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Check ownership
      const existing = await prisma.maintenance.findFirst({
        where: { id: maintenanceId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Maintenance not found' })
      }

      // Delete associations first
      await prisma.maintenanceMonitor.deleteMany({ where: { maintenanceId } })
      await prisma.maintenanceStatusPage.deleteMany({ where: { maintenanceId } })
      
      // Delete maintenance
      await prisma.maintenance.delete({ where: { id: maintenanceId } })

      callback({ ok: true })

      // Broadcast deletion
      broadcastMaintenanceDeleted(socket.userId, maintenanceId)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async pauseMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.maintenance.findFirst({
        where: { id: maintenanceId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Maintenance not found' })
      }

      const updated = await prisma.maintenance.update({
        where: { id: maintenanceId },
        data: { active: false }
      })

      callback({ ok: true, maintenance: updated })
      broadcastMaintenanceUpdated(socket.userId, updated)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async resumeMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.maintenance.findFirst({
        where: { id: maintenanceId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Maintenance not found' })
      }

      const updated = await prisma.maintenance.update({
        where: { id: maintenanceId },
        data: { active: true }
      })

      callback({ ok: true, maintenance: updated })
      broadcastMaintenanceUpdated(socket.userId, updated)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Status Page CRUD Events
  // =====================
  async addStatusPage(socket: AuthenticatedSocket, data: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const statusPage = await prisma.statusPage.create({
        data: {
          userId: socket.userId,
          slug: data.slug,
          title: data.title,
          description: data.description || null,
          theme: data.theme || 'light',
          published: data.published ?? false,
          showTags: data.showTags ?? true,
          showPoweredBy: data.showPoweredBy ?? true,
          customCss: data.customCss || null,
          footerText: data.footerText || null,
          icon: data.icon || null,
          googleAnalyticsId: data.googleAnalyticsId || null
        }
      })

      callback({ ok: true, statusPage })
      broadcastStatusPageAdded(socket.userId, statusPage)
    } catch (error: any) {
      if (error.code === 'P2002') {
        return callback({ ok: false, msg: 'Slug already exists' })
      }
      callback({ ok: false, msg: error.message })
    }
  },

  async saveStatusPage(socket: AuthenticatedSocket, data: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.statusPage.findFirst({
        where: { id: data.id, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Status page not found' })
      }

      const updated = await prisma.statusPage.update({
        where: { id: data.id },
        data: {
          slug: data.slug,
          title: data.title,
          description: data.description || null,
          theme: data.theme || 'light',
          published: data.published ?? false,
          showTags: data.showTags ?? true,
          showPoweredBy: data.showPoweredBy ?? true,
          customCss: data.customCss || null,
          footerText: data.footerText || null,
          icon: data.icon || null,
          googleAnalyticsId: data.googleAnalyticsId || null
        }
      })

      // Handle groups/monitors update
      if (data.publicGroupList && Array.isArray(data.publicGroupList)) {
        // Delete existing groups and monitors
        await prisma.statusPageMonitor.deleteMany({ where: { statusPageId: data.id } })
        await prisma.statusPageGroup.deleteMany({ where: { statusPageId: data.id } })

        // Create new groups and monitors
        for (const group of data.publicGroupList) {
          const createdGroup = await prisma.statusPageGroup.create({
            data: {
              statusPageId: data.id,
              name: group.name,
              weight: group.weight || 0
            }
          })

          if (group.monitorList && group.monitorList.length > 0) {
            await prisma.statusPageMonitor.createMany({
              data: group.monitorList.map((monitorId: number, index: number) => ({
                statusPageId: data.id,
                statusPageGroupId: createdGroup.id,
                monitorId,
                weight: index
              }))
            })
          }
        }
      }

      callback({ ok: true, statusPage: updated })
      broadcastStatusPageUpdated(socket.userId, updated)
    } catch (error: any) {
      if (error.code === 'P2002') {
        return callback({ ok: false, msg: 'Slug already exists' })
      }
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteStatusPage(socket: AuthenticatedSocket, slug: string, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.statusPage.findFirst({
        where: { slug, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Status page not found' })
      }

      // Delete related data
      await prisma.statusPageMonitor.deleteMany({ where: { group: { statusPageId: existing.id } } })
      await prisma.statusPageGroup.deleteMany({ where: { statusPageId: existing.id } })
      await prisma.incident.deleteMany({ where: { statusPageId: existing.id } })
      
      // Delete status page
      await prisma.statusPage.delete({ where: { id: existing.id } })

      callback({ ok: true })
      broadcastStatusPageDeleted(socket.userId, existing.id)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // Incident events
  async postIncident(socket: AuthenticatedSocket, slug: string, incident: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const statusPage = await prisma.statusPage.findFirst({
        where: { slug, userId: socket.userId }
      })

      if (!statusPage) {
        return callback({ ok: false, msg: 'Status page not found' })
      }

      const created = await prisma.incident.create({
        data: {
          statusPageId: statusPage.id,
          title: incident.title,
          content: incident.content,
          style: incident.style || 'info',
          pin: incident.pin ?? true,
          createdAt: new Date()
        }
      })

      callback({ ok: true, incident: created })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async unpinIncident(socket: AuthenticatedSocket, slug: string, incidentId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const statusPage = await prisma.statusPage.findFirst({
        where: { slug, userId: socket.userId }
      })

      if (!statusPage) {
        return callback({ ok: false, msg: 'Status page not found' })
      }

      const incident = await prisma.incident.findFirst({
        where: { id: incidentId, statusPageId: statusPage.id }
      })

      if (!incident) {
        return callback({ ok: false, msg: 'Incident not found' })
      }

      const updated = await prisma.incident.update({
        where: { id: incidentId },
        data: { pin: false }
      })

      callback({ ok: true, incident: updated })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // API Key Events
  // =====================
  async getAPIKeyList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId: socket.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          active: true,
          expires: true,
          createdAt: true
          // Don't return the actual key for security
        }
      })

      callback({ ok: true, apiKeys })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async addAPIKey(socket: AuthenticatedSocket, data: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const key = `uk-${generateId(32)}`
      
      const apiKey = await prisma.apiKey.create({
        data: {
          userId: socket.userId,
          name: data.name,
          key,
          active: true,
          expires: data.expires ? new Date(data.expires) : null
        }
      })

      // Return the key only on creation
      callback({ 
        ok: true, 
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key, // Include full key only on creation
          active: apiKey.active,
          expires: apiKey.expires,
          createdAt: apiKey.createdAt
        }
      })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteAPIKey(socket: AuthenticatedSocket, keyId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.apiKey.findFirst({
        where: { id: keyId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'API Key not found' })
      }

      await prisma.apiKey.delete({ where: { id: keyId } })

      callback({ ok: true })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Proxy Events
  // =====================
  async getProxyList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const proxies = await prisma.proxy.findMany({
        where: { userId: socket.userId },
        orderBy: { createdAt: 'desc' }
      })

      callback({ ok: true, proxies })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async addProxy(socket: AuthenticatedSocket, proxy: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const created = await prisma.proxy.create({
        data: {
          userId: socket.userId,
          protocol: proxy.protocol || 'http',
          host: proxy.host,
          port: proxy.port,
          active: proxy.active ?? true,
          isDefault: proxy.default ?? proxy.isDefault ?? false,
          auth: proxy.auth ?? false,
          username: proxy.username || null,
          password: proxy.password || null
        }
      })

      // If this proxy is set as default, unset others
      if (created.isDefault) {
        await prisma.proxy.updateMany({
          where: {
            userId: socket.userId,
            id: { not: created.id }
          },
          data: { isDefault: false }
        })
      }

      callback({ ok: true, proxy: created })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async editProxy(socket: AuthenticatedSocket, proxy: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.proxy.findFirst({
        where: { id: proxy.id, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Proxy not found' })
      }

      const updated = await prisma.proxy.update({
        where: { id: proxy.id },
        data: {
          protocol: proxy.protocol || 'http',
          host: proxy.host,
          port: proxy.port,
          active: proxy.active ?? true,
          isDefault: proxy.default ?? proxy.isDefault ?? false,
          auth: proxy.auth ?? false,
          username: proxy.username || null,
          password: proxy.password || null
        }
      })

      // If this proxy is set as default, unset others
      if (updated.isDefault) {
        await prisma.proxy.updateMany({
          where: {
            userId: socket.userId,
            id: { not: updated.id }
          },
          data: { isDefault: false }
        })
      }

      callback({ ok: true, proxy: updated })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteProxy(socket: AuthenticatedSocket, proxyId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.proxy.findFirst({
        where: { id: proxyId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Proxy not found' })
      }

      await prisma.proxy.delete({ where: { id: proxyId } })

      callback({ ok: true })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Docker Host Events
  // =====================
  async getDockerHostList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const dockerHosts = await prisma.dockerHost.findMany({
        where: { userId: socket.userId },
        orderBy: { name: 'asc' }
      })

      callback({ ok: true, dockerHosts })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async addDockerHost(socket: AuthenticatedSocket, dockerHost: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const created = await prisma.dockerHost.create({
        data: {
          userId: socket.userId,
          name: dockerHost.name,
          dockerType: dockerHost.dockerType || 'socket',
          dockerDaemon: dockerHost.dockerDaemon || '/var/run/docker.sock'
        }
      })

      callback({ ok: true, dockerHost: created })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async editDockerHost(socket: AuthenticatedSocket, dockerHost: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.dockerHost.findFirst({
        where: { id: dockerHost.id, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Docker host not found' })
      }

      const updated = await prisma.dockerHost.update({
        where: { id: dockerHost.id },
        data: {
          name: dockerHost.name,
          dockerType: dockerHost.dockerType || 'socket',
          dockerDaemon: dockerHost.dockerDaemon || '/var/run/docker.sock'
        }
      })

      callback({ ok: true, dockerHost: updated })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteDockerHost(socket: AuthenticatedSocket, dockerHostId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.dockerHost.findFirst({
        where: { id: dockerHostId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Docker host not found' })
      }

      await prisma.dockerHost.delete({ where: { id: dockerHostId } })

      callback({ ok: true })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async testDockerHost(socket: AuthenticatedSocket, dockerHost: any, callback: Function) {
    // Placeholder - actual Docker connectivity test would require Docker SDK
    try {
      // For now, just verify the host parameters are valid
      if (!dockerHost.dockerDaemon) {
        return callback({ ok: false, msg: 'Docker daemon path is required' })
      }

      callback({ ok: true, msg: 'Docker host configuration looks valid' })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Tag Events (Extended)
  // =====================
  async addTag(socket: AuthenticatedSocket, tag: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const created = await prisma.tag.create({
        data: {
          userId: socket.userId,
          name: tag.name,
          color: tag.color || '#808080'
        }
      })

      callback({ ok: true, tag: created })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async editTag(socket: AuthenticatedSocket, tag: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.tag.findFirst({
        where: { id: tag.id, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Tag not found' })
      }

      const updated = await prisma.tag.update({
        where: { id: tag.id },
        data: {
          name: tag.name,
          color: tag.color || '#808080'
        }
      })

      callback({ ok: true, tag: updated })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteTag(socket: AuthenticatedSocket, tagId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.tag.findFirst({
        where: { id: tagId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Tag not found' })
      }

      // Delete associations first
      await prisma.monitorTag.deleteMany({ where: { tagId } })
      
      // Delete tag
      await prisma.tag.delete({ where: { id: tagId } })

      callback({ ok: true })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Monitor Events (Extended)
  // =====================
  async addMonitor(socket: AuthenticatedSocket, monitor: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const created = await prisma.monitor.create({
        data: {
          userId: socket.userId,
          name: monitor.name,
          type: monitor.type,
          url: monitor.url || null,
          hostname: monitor.hostname || null,
          port: monitor.port || null,
          interval: monitor.interval || 60,
          retryInterval: monitor.retryInterval || 60,
          maxretries: monitor.maxretries || 0,
          active: monitor.active ?? true,
          method: monitor.method || 'GET',
          headers: monitor.headers || null,
          body: monitor.body || null,
          expectedValue: monitor.expectedValue || null,
          keyword: monitor.keyword || null,
          invertKeyword: monitor.invertKeyword ?? false,
          ignoreTls: monitor.ignoreTls ?? false,
          maxRedirects: monitor.maxRedirects || 10,
          acceptedStatuscodes: monitor.acceptedStatuscodes ? JSON.stringify(monitor.acceptedStatuscodes) : '["200-299"]',
          description: monitor.description || null,
          proxyId: monitor.proxyId || null,
          authMethod: monitor.authMethod || null,
          basicAuthUser: monitor.basicAuthUser || null,
          basicAuthPass: monitor.basicAuthPass || null,
          pushToken: monitor.type === 'push' ? generateId(16) : null,
          databaseQuery: monitor.databaseQuery || null,
          databaseConnectionString: monitor.databaseConnectionString || null,
          grpcUrl: monitor.grpcUrl || null,
          grpcProtoContent: monitor.grpcProtoContent || null,
          grpcMethod: monitor.grpcMethod || null,
          grpcServiceName: monitor.grpcServiceName || null,
          grpcBody: monitor.grpcBody || null,
          grpcMetadata: monitor.grpcMetadata || null,
          dockerHost: monitor.dockerHost || null,
          dockerContainer: monitor.dockerContainer || null,
          radiusUsername: monitor.radiusUsername || null,
          radiusPassword: monitor.radiusPassword || null,
          radiusSecret: monitor.radiusSecret || null,
          radiusCalledStationId: monitor.radiusCalledStationId || null,
          radiusCallingStationId: monitor.radiusCallingStationId || null,
          mqttTopic: monitor.mqttTopic || null,
          mqttUsername: monitor.mqttUsername || null,
          mqttPassword: monitor.mqttPassword || null,
          mqttSuccessMessage: monitor.mqttSuccessMessage || null,
          gamedig: monitor.gamedig || null,
          jsonPath: monitor.jsonPath || null,
          kafkaProducerTopic: monitor.kafkaProducerTopic || null,
          kafkaProducerBrokers: monitor.kafkaProducerBrokers || null,
          kafkaProducerSaslOptions: monitor.kafkaProducerSaslOptions || null,
          kafkaProducerSsl: monitor.kafkaProducerSsl ?? false,
          kafkaProducerMessage: monitor.kafkaProducerMessage || null,
          parentId: monitor.parentId || null
        }
      })

      // Handle tags
      if (monitor.notificationIDList && monitor.notificationIDList.length > 0) {
        await prisma.monitorNotification.createMany({
          data: monitor.notificationIDList.map((notificationId: number) => ({
            monitorId: created.id,
            notificationId
          }))
        })
      }

      // Handle tags
      if (monitor.tags && monitor.tags.length > 0) {
        await prisma.monitorTag.createMany({
          data: monitor.tags.map((tag: any) => ({
            monitorId: created.id,
            tagId: tag.tagId || tag.id,
            value: tag.value || ''
          }))
        })
      }

      const fullMonitor = await prisma.monitor.findUnique({
        where: { id: created.id },
        include: {
          tags: { include: { tag: true } },
          monitorNotifications: { include: { notification: true } }
        }
      })

      callback({ ok: true, monitor: fullMonitor })
      broadcastMonitorAdded(socket.userId, fullMonitor)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async editMonitor(socket: AuthenticatedSocket, monitor: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.monitor.findFirst({
        where: { id: monitor.id, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      const updated = await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          name: monitor.name,
          type: monitor.type,
          url: monitor.url || null,
          hostname: monitor.hostname || null,
          port: monitor.port || null,
          interval: monitor.interval || 60,
          retryInterval: monitor.retryInterval || 60,
          maxretries: monitor.maxretries || 0,
          active: monitor.active ?? true,
          method: monitor.method || 'GET',
          headers: monitor.headers || null,
          body: monitor.body || null,
          expectedValue: monitor.expectedValue || null,
          keyword: monitor.keyword || null,
          invertKeyword: monitor.invertKeyword ?? false,
          ignoreTls: monitor.ignoreTls ?? false,
          maxRedirects: monitor.maxRedirects || 10,
          acceptedStatuscodes: monitor.acceptedStatuscodes ? JSON.stringify(monitor.acceptedStatuscodes) : '["200-299"]',
          description: monitor.description || null,
          proxyId: monitor.proxyId || null,
          authMethod: monitor.authMethod || null,
          basicAuthUser: monitor.basicAuthUser || null,
          basicAuthPass: monitor.basicAuthPass || null,
          databaseQuery: monitor.databaseQuery || null,
          databaseConnectionString: monitor.databaseConnectionString || null,
          grpcUrl: monitor.grpcUrl || null,
          grpcProtoContent: monitor.grpcProtoContent || null,
          grpcMethod: monitor.grpcMethod || null,
          grpcServiceName: monitor.grpcServiceName || null,
          grpcBody: monitor.grpcBody || null,
          grpcMetadata: monitor.grpcMetadata || null,
          dockerHost: monitor.dockerHost || null,
          dockerContainer: monitor.dockerContainer || null,
          radiusUsername: monitor.radiusUsername || null,
          radiusPassword: monitor.radiusPassword || null,
          radiusSecret: monitor.radiusSecret || null,
          radiusCalledStationId: monitor.radiusCalledStationId || null,
          radiusCallingStationId: monitor.radiusCallingStationId || null,
          mqttTopic: monitor.mqttTopic || null,
          mqttUsername: monitor.mqttUsername || null,
          mqttPassword: monitor.mqttPassword || null,
          mqttSuccessMessage: monitor.mqttSuccessMessage || null,
          gamedig: monitor.gamedig || null,
          jsonPath: monitor.jsonPath || null,
          kafkaProducerTopic: monitor.kafkaProducerTopic || null,
          kafkaProducerBrokers: monitor.kafkaProducerBrokers || null,
          kafkaProducerSaslOptions: monitor.kafkaProducerSaslOptions || null,
          kafkaProducerSsl: monitor.kafkaProducerSsl ?? false,
          kafkaProducerMessage: monitor.kafkaProducerMessage || null,
          parentId: monitor.parentId || null
        }
      })

      // Update notifications
      await prisma.monitorNotification.deleteMany({ where: { monitorId: monitor.id } })
      if (monitor.notificationIDList && monitor.notificationIDList.length > 0) {
        await prisma.monitorNotification.createMany({
          data: monitor.notificationIDList.map((notificationId: number) => ({
            monitorId: monitor.id,
            notificationId
          }))
        })
      }

      // Update tags
      await prisma.monitorTag.deleteMany({ where: { monitorId: monitor.id } })
      if (monitor.tags && monitor.tags.length > 0) {
        await prisma.monitorTag.createMany({
          data: monitor.tags.map((tag: any) => ({
            monitorId: monitor.id,
            tagId: tag.tagId || tag.id,
            value: tag.value || ''
          }))
        })
      }

      const fullMonitor = await prisma.monitor.findUnique({
        where: { id: monitor.id },
        include: {
          tags: { include: { tag: true } },
          monitorNotifications: { include: { notification: true } }
        }
      })

      callback({ ok: true, monitor: fullMonitor })
      broadcastMonitorUpdate(socket.userId, fullMonitor)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteMonitor(socket: AuthenticatedSocket, monitorId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      // Delete related data
      await prisma.heartbeat.deleteMany({ where: { monitorId } })
      await prisma.monitorTag.deleteMany({ where: { monitorId } })
      await prisma.monitorNotification.deleteMany({ where: { monitorId } })
      await prisma.maintenanceMonitor.deleteMany({ where: { monitorId } })
      await prisma.statusPageMonitor.deleteMany({ where: { monitorId } })
      
      // Delete monitor
      await prisma.monitor.delete({ where: { id: monitorId } })

      callback({ ok: true })
      broadcastMonitorDeleted(socket.userId, monitorId)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async pauseMonitor(socket: AuthenticatedSocket, monitorId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      const updated = await prisma.monitor.update({
        where: { id: monitorId },
        data: { active: false }
      })

      callback({ ok: true, monitor: updated })
      broadcastMonitorUpdate(socket.userId, updated)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async resumeMonitor(socket: AuthenticatedSocket, monitorId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      const updated = await prisma.monitor.update({
        where: { id: monitorId },
        data: { active: true }
      })

      callback({ ok: true, monitor: updated })
      broadcastMonitorUpdate(socket.userId, updated)
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Notification Events (Extended)
  // =====================
  async addNotification(socket: AuthenticatedSocket, notification: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const created = await prisma.notification.create({
        data: {
          userId: socket.userId,
          name: notification.name,
          type: notification.type,
          isDefault: notification.isDefault ?? false,
          active: notification.active ?? true,
          config: notification.config || '{}'
        }
      })

      callback({ ok: true, notification: created })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async editNotification(socket: AuthenticatedSocket, notification: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.notification.findFirst({
        where: { id: notification.id, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Notification not found' })
      }

      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: {
          name: notification.name,
          type: notification.type,
          isDefault: notification.isDefault ?? false,
          active: notification.active ?? true,
          config: notification.config || '{}'
        }
      })

      callback({ ok: true, notification: updated })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteNotification(socket: AuthenticatedSocket, notificationId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const existing = await prisma.notification.findFirst({
        where: { id: notificationId, userId: socket.userId }
      })

      if (!existing) {
        return callback({ ok: false, msg: 'Notification not found' })
      }

      // Delete associations first
      await prisma.monitorNotification.deleteMany({ where: { notificationId } })
      
      // Delete notification
      await prisma.notification.delete({ where: { id: notificationId } })

      callback({ ok: true })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async testNotification(socket: AuthenticatedSocket, notification: any, callback: Function) {
    // Import notification service
    try {
      // TODO: Implement actual notification test
      callback({ ok: true, msg: 'Test notification sent successfully (placeholder)' })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Chart Data Events
  // =====================
  async getMonitorChartData(socket: AuthenticatedSocket, monitorId: number, period: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const monitor = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId }
      })

      if (!monitor) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      const since = new Date(Date.now() - period * 60 * 60 * 1000)
      
      const heartbeats = await prisma.heartbeat.findMany({
        where: {
          monitorId,
          time: { gte: since }
        },
        orderBy: { time: 'asc' },
        select: {
          time: true,
          status: true,
          ping: true,
          msg: true
        }
      })

      callback({ ok: true, data: heartbeats })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Database Events
  // =====================
  async shrinkDatabase(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // PostgreSQL VACUUM
      await prisma.$executeRaw`VACUUM ANALYZE`
      callback({ ok: true, msg: 'Database optimized successfully' })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async clearStatistics(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Get all user's monitors
      const monitors = await prisma.monitor.findMany({
        where: { userId: socket.userId },
        select: { id: true }
      })

      const monitorIds = monitors.map(m => m.id)

      // Clear heartbeats for user's monitors
      await prisma.heartbeat.deleteMany({
        where: { monitorId: { in: monitorIds } }
      })

      callback({ ok: true, msg: 'Statistics cleared successfully' })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async clearHeartbeats(socket: AuthenticatedSocket, monitorId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const monitor = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId }
      })

      if (!monitor) {
        return callback({ ok: false, msg: 'Monitor not found' })
      }

      await prisma.heartbeat.deleteMany({
        where: { monitorId }
      })

      callback({ ok: true, msg: 'Heartbeats cleared successfully' })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // General Events
  // =====================
  async initServerTimezone(socket: AuthenticatedSocket, callback: Function) {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      callback({ ok: true, timezone })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async getGameList(socket: AuthenticatedSocket, callback: Function) {
    // Return list of supported games for GameDig
    const games = [
      { id: 'minecraft', name: 'Minecraft' },
      { id: 'csgo', name: 'Counter-Strike: Global Offensive' },
      { id: 'css', name: 'Counter-Strike: Source' },
      { id: 'tf2', name: 'Team Fortress 2' },
      { id: 'rust', name: 'Rust' },
      { id: 'ark', name: 'ARK: Survival Evolved' },
      { id: 'garrysmod', name: "Garry's Mod" },
      { id: 'valheim', name: 'Valheim' },
      { id: '7d2d', name: '7 Days to Die' },
      { id: 'factorio', name: 'Factorio' },
      { id: 'terraria', name: 'Terraria' },
      { id: 'unturned', name: 'Unturned' },
      { id: 'dayz', name: 'DayZ' },
      { id: 'squad', name: 'Squad' },
      { id: 'projectzomboid', name: 'Project Zomboid' }
    ]
    
    callback({ ok: true, games })
  },

  async getPushExample(socket: AuthenticatedSocket, monitorId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const monitor = await prisma.monitor.findFirst({
        where: { id: monitorId, userId: socket.userId, type: 'push' }
      })

      if (!monitor) {
        return callback({ ok: false, msg: 'Push monitor not found' })
      }

      const baseUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const pushUrl = `${baseUrl}/api/push/${monitor.pushToken}`

      const examples = {
        bash: `curl "${pushUrl}?status=up&msg=OK&ping="`,
        powershell: `Invoke-WebRequest -Uri "${pushUrl}?status=up&msg=OK&ping=" -Method GET`,
        python: `import requests\nrequests.get("${pushUrl}", params={"status": "up", "msg": "OK", "ping": ""})`,
        javascript: `fetch("${pushUrl}?status=up&msg=OK&ping=")`,
        url: pushUrl
      }

      callback({ ok: true, examples })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  }
}

export function initSocketServer(httpServer: HTTPServer) {
  if (io) {
    console.log('[Socket.io] Already initialized')
    return io
  }

  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'development' ? '*' : undefined,
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    // Handle authentication
    socket.on('loginByToken', async (token: string, callback: Function) => {
      try {
        // TODO: Implement JWT token verification
        // For now, just mark as authenticated with a mock user
        socket.userId = 1
        socket.username = 'admin'
        callback({ ok: true })
      } catch (error: any) {
        callback({ ok: false, msg: error.message })
      }
    })

    // =====================
    // Monitor Event Handlers
    // =====================
    socket.on('getMonitorList', (callback) => socketHandlers.getMonitorList(socket, callback))
    socket.on('getMonitor', (monitorId, callback) => socketHandlers.getMonitor(socket, monitorId, callback))
    socket.on('getMonitorBeats', (monitorId, period, callback) => socketHandlers.getMonitorBeats(socket, monitorId, period, callback))
    socket.on('addMonitor', (monitor, callback) => socketHandlers.addMonitor(socket, monitor, callback))
    socket.on('editMonitor', (monitor, callback) => socketHandlers.editMonitor(socket, monitor, callback))
    socket.on('deleteMonitor', (monitorId, callback) => socketHandlers.deleteMonitor(socket, monitorId, callback))
    socket.on('pauseMonitor', (monitorId, callback) => socketHandlers.pauseMonitor(socket, monitorId, callback))
    socket.on('resumeMonitor', (monitorId, callback) => socketHandlers.resumeMonitor(socket, monitorId, callback))
    socket.on('getMonitorChartData', (monitorId, period, callback) => socketHandlers.getMonitorChartData(socket, monitorId, period, callback))

    // =====================
    // Notification Event Handlers
    // =====================
    socket.on('getNotificationList', (callback) => socketHandlers.getNotificationList(socket, callback))
    socket.on('addNotification', (notification, callback) => socketHandlers.addNotification(socket, notification, callback))
    socket.on('editNotification', (notification, callback) => socketHandlers.editNotification(socket, notification, callback))
    socket.on('deleteNotification', (notificationId, callback) => socketHandlers.deleteNotification(socket, notificationId, callback))
    socket.on('testNotification', (notification, callback) => socketHandlers.testNotification(socket, notification, callback))

    // =====================
    // Tag Event Handlers
    // =====================
    socket.on('getTags', (callback) => socketHandlers.getTags(socket, callback))
    socket.on('addTag', (tag, callback) => socketHandlers.addTag(socket, tag, callback))
    socket.on('editTag', (tag, callback) => socketHandlers.editTag(socket, tag, callback))
    socket.on('deleteTag', (tagId, callback) => socketHandlers.deleteTag(socket, tagId, callback))

    // =====================
    // Status Page Event Handlers
    // =====================
    socket.on('getStatusPageList', (callback) => socketHandlers.getStatusPageList(socket, callback))
    socket.on('addStatusPage', (data, callback) => socketHandlers.addStatusPage(socket, data, callback))
    socket.on('saveStatusPage', (data, callback) => socketHandlers.saveStatusPage(socket, data, callback))
    socket.on('deleteStatusPage', (slug, callback) => socketHandlers.deleteStatusPage(socket, slug, callback))
    socket.on('postIncident', (slug, incident, callback) => socketHandlers.postIncident(socket, slug, incident, callback))
    socket.on('unpinIncident', (slug, incidentId, callback) => socketHandlers.unpinIncident(socket, slug, incidentId, callback))

    // =====================
    // Maintenance Event Handlers
    // =====================
    socket.on('getMaintenanceList', (callback) => socketHandlers.getMaintenanceList(socket, callback))
    socket.on('getMaintenance', (maintenanceId, callback) => socketHandlers.getMaintenance(socket, maintenanceId, callback))
    socket.on('addMaintenance', (maintenance, callback) => socketHandlers.addMaintenance(socket, maintenance, callback))
    socket.on('editMaintenance', (maintenance, callback) => socketHandlers.editMaintenance(socket, maintenance, callback))
    socket.on('deleteMaintenance', (maintenanceId, callback) => socketHandlers.deleteMaintenance(socket, maintenanceId, callback))
    socket.on('pauseMaintenance', (maintenanceId, callback) => socketHandlers.pauseMaintenance(socket, maintenanceId, callback))
    socket.on('resumeMaintenance', (maintenanceId, callback) => socketHandlers.resumeMaintenance(socket, maintenanceId, callback))

    // =====================
    // API Key Event Handlers
    // =====================
    socket.on('getAPIKeyList', (callback) => socketHandlers.getAPIKeyList(socket, callback))
    socket.on('addAPIKey', (data, callback) => socketHandlers.addAPIKey(socket, data, callback))
    socket.on('deleteAPIKey', (keyId, callback) => socketHandlers.deleteAPIKey(socket, keyId, callback))

    // =====================
    // Proxy Event Handlers
    // =====================
    socket.on('getProxyList', (callback) => socketHandlers.getProxyList(socket, callback))
    socket.on('addProxy', (proxy, callback) => socketHandlers.addProxy(socket, proxy, callback))
    socket.on('editProxy', (proxy, callback) => socketHandlers.editProxy(socket, proxy, callback))
    socket.on('deleteProxy', (proxyId, callback) => socketHandlers.deleteProxy(socket, proxyId, callback))

    // =====================
    // Docker Host Event Handlers
    // =====================
    socket.on('getDockerHostList', (callback) => socketHandlers.getDockerHostList(socket, callback))
    socket.on('addDockerHost', (dockerHost, callback) => socketHandlers.addDockerHost(socket, dockerHost, callback))
    socket.on('editDockerHost', (dockerHost, callback) => socketHandlers.editDockerHost(socket, dockerHost, callback))
    socket.on('deleteDockerHost', (dockerHostId, callback) => socketHandlers.deleteDockerHost(socket, dockerHostId, callback))
    socket.on('testDockerHost', (dockerHost, callback) => socketHandlers.testDockerHost(socket, dockerHost, callback))

    // =====================
    // Database Event Handlers
    // =====================
    socket.on('shrinkDatabase', (callback) => socketHandlers.shrinkDatabase(socket, callback))
    socket.on('clearStatistics', (callback) => socketHandlers.clearStatistics(socket, callback))
    socket.on('clearHeartbeats', (monitorId, callback) => socketHandlers.clearHeartbeats(socket, monitorId, callback))

    // =====================
    // General Event Handlers
    // =====================
    socket.on('initServerTimezone', (callback) => socketHandlers.initServerTimezone(socket, callback))
    socket.on('getGameList', (callback) => socketHandlers.getGameList(socket, callback))
    socket.on('getPushExample', (monitorId, callback) => socketHandlers.getPushExample(socket, monitorId, callback))

    // =====================
    // Subscription Event Handlers (for real-time updates)
    // =====================
    socket.on('subscribe_monitors', () => {
      socket.join('monitors')
      console.log(`[Socket.io] ${socket.id} subscribed to monitors`)
    })

    socket.on('unsubscribe_monitors', () => {
      socket.leave('monitors')
      console.log(`[Socket.io] ${socket.id} unsubscribed from monitors`)
    })

    socket.on('subscribe_monitor', (monitorId: number) => {
      socket.join(`monitor:${monitorId}`)
      console.log(`[Socket.io] ${socket.id} subscribed to monitor:${monitorId}`)
    })

    socket.on('unsubscribe_monitor', (monitorId: number) => {
      socket.leave(`monitor:${monitorId}`)
      console.log(`[Socket.io] ${socket.id} unsubscribed from monitor:${monitorId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`)
    })
  })

  console.log('[Socket.io] Server created')
  return io
}

export function getIO(): SocketServer | null {
  return io
}

// Broadcast functions for use by other services
export function broadcastHeartbeat(userId: number, monitorId: number, heartbeat: any) {
  if (!io) return
  
  // Broadcast to all sockets of this user
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('heartbeat', { monitorId, heartbeat })
    }
  })
}

export function broadcastMonitorUpdate(userId: number, monitor: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('monitorUpdate', monitor)
    }
  })
}

export function broadcastMonitorAdded(userId: number, monitor: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('monitorAdded', monitor)
    }
  })
}

export function broadcastMonitorDeleted(userId: number, monitorId: number) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('monitorDeleted', monitorId)
    }
  })
}

// Maintenance broadcast functions
export function broadcastMaintenanceAdded(userId: number, maintenance: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('maintenanceAdded', maintenance)
    }
  })
}

export function broadcastMaintenanceUpdated(userId: number, maintenance: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('maintenanceUpdated', maintenance)
    }
  })
}

export function broadcastMaintenanceDeleted(userId: number, maintenanceId: number) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('maintenanceDeleted', maintenanceId)
    }
  })
}

// Status page broadcast functions
export function broadcastStatusPageAdded(userId: number, statusPage: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('statusPageAdded', statusPage)
    }
  })
}

export function broadcastStatusPageUpdated(userId: number, statusPage: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('statusPageUpdated', statusPage)
    }
  })
}

export function broadcastStatusPageDeleted(userId: number, statusPageId: number) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('statusPageDeleted', statusPageId)
    }
  })
}

// Tag broadcast functions
export function broadcastTagAdded(userId: number, tag: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('tagAdded', tag)
    }
  })
}

export function broadcastTagUpdated(userId: number, tag: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('tagUpdated', tag)
    }
  })
}

export function broadcastTagDeleted(userId: number, tagId: number) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('tagDeleted', tagId)
    }
  })
}

// Notification broadcast functions
export function broadcastNotificationAdded(userId: number, notification: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('notificationAdded', notification)
    }
  })
}

export function broadcastNotificationUpdated(userId: number, notification: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('notificationUpdated', notification)
    }
  })
}

export function broadcastNotificationDeleted(userId: number, notificationId: number) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('notificationDeleted', notificationId)
    }
  })
}

// Proxy broadcast functions
export function broadcastProxyAdded(userId: number, proxy: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('proxyAdded', proxy)
    }
  })
}

export function broadcastProxyUpdated(userId: number, proxy: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('proxyUpdated', proxy)
    }
  })
}

export function broadcastProxyDeleted(userId: number, proxyId: number) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('proxyDeleted', proxyId)
    }
  })
}

// Docker host broadcast functions
export function broadcastDockerHostAdded(userId: number, dockerHost: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('dockerHostAdded', dockerHost)
    }
  })
}

export function broadcastDockerHostUpdated(userId: number, dockerHost: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('dockerHostUpdated', dockerHost)
    }
  })
}

export function broadcastDockerHostDeleted(userId: number, dockerHostId: number) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('dockerHostDeleted', dockerHostId)
    }
  })
}

// =====================
// Emit Heartbeat (for scheduler)
// =====================
export function emitHeartbeat(monitorId: number, heartbeat: any) {
  if (!io) return
  
  const payload = { monitorId, heartbeat }
  
  // Broadcast to 'monitors' room (for dashboard subscribers)
  io.to('monitors').emit('heartbeat', payload)
  
  // Also emit to specific monitor room (for detail page subscribers)
  io.to(`monitor:${monitorId}`).emit('heartbeat', payload)
  
  console.log(`[Socket] Emitted heartbeat for monitor ${monitorId}: status=${heartbeat.status}`)
}

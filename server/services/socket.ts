import { prisma } from '../utils/prisma'
// server/services/socket.ts
// WebSocket service for real-time communication
import { Server as HTTPServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { getMonitorTypeListForClient } from './monitor/types'



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

type MaintenanceService = typeof import('./maintenance/service')

async function runMaintenanceSocket(
  socket: AuthenticatedSocket,
  callback: Function,
  fn: (svc: MaintenanceService, userId: number) => Promise<Record<string, unknown>>,
) {
  if (typeof callback !== 'function') return
  if (!socket.userId) return callback({ ok: false, msg: 'Not authenticated' })
  try {
    const svc = await import('./maintenance/service')
    callback({ ok: true, ...(await fn(svc, socket.userId)) })
  } catch (error: any) {
    callback({ ok: false, msg: error?.message || 'Unknown error' })
  }
}

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

  // Get monitor type list with condition support info
  async getMonitorTypeList(socket: AuthenticatedSocket, callback: Function) {
    try {
      const monitorTypeList = getMonitorTypeListForClient()
      callback({ ok: true, monitorTypeList })
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

  // Important Heartbeat events (status change history)
  async getImportantHeartbeatListCount(socket: AuthenticatedSocket, monitorId: number | null, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      let count: number
      
      if (monitorId === null) {
        // Get count for all monitors belonging to user
        const monitors = await prisma.monitor.findMany({
          where: { userId: socket.userId },
          select: { id: true }
        })
        const monitorIds = monitors.map(m => m.id)
        
        count = await prisma.heartbeat.count({
          where: {
            monitorId: { in: monitorIds },
            important: true
          }
        })
      } else {
        // Verify ownership
        const monitor = await prisma.monitor.findFirst({
          where: { id: monitorId, userId: socket.userId }
        })
        
        if (!monitor) {
          return callback({ ok: false, msg: 'Monitor not found' })
        }
        
        count = await prisma.heartbeat.count({
          where: {
            monitorId,
            important: true
          }
        })
      }
      
      callback({ ok: true, count })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async getImportantHeartbeatListPaged(socket: AuthenticatedSocket, monitorId: number | null, offset: number, count: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      let heartbeats: any[]
      
      if (monitorId === null) {
        // Get important heartbeats for all monitors belonging to user
        const monitors = await prisma.monitor.findMany({
          where: { userId: socket.userId },
          select: { id: true, name: true }
        })
        const monitorIds = monitors.map(m => m.id)
        const monitorMap = new Map(monitors.map(m => [m.id, m.name]))
        
        heartbeats = await prisma.heartbeat.findMany({
          where: {
            monitorId: { in: monitorIds },
            important: true
          },
          orderBy: { time: 'desc' },
          take: count,
          skip: offset
        })
        
        // Add monitor name to each heartbeat
        heartbeats = heartbeats.map(hb => ({
          ...hb,
          monitorName: monitorMap.get(hb.monitorId) || 'Unknown'
        }))
      } else {
        // Verify ownership
        const monitor = await prisma.monitor.findFirst({
          where: { id: monitorId, userId: socket.userId }
        })
        
        if (!monitor) {
          return callback({ ok: false, msg: 'Monitor not found' })
        }
        
        heartbeats = await prisma.heartbeat.findMany({
          where: {
            monitorId,
            important: true
          },
          orderBy: { time: 'desc' },
          take: count,
          skip: offset
        })
        
        // Add monitor name
        heartbeats = heartbeats.map(hb => ({
          ...hb,
          monitorName: monitor.name
        }))
      }
      
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

  // Maintenance events (all logic lives in services/maintenance/service.ts)
  async getMaintenanceList(socket: AuthenticatedSocket, callback: Function) {
    await runMaintenanceSocket(socket, callback, async (svc, userId) => ({
      maintenances: await svc.listMaintenances(userId),
    }))
  },

  async getMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    await runMaintenanceSocket(socket, callback, async (svc, userId) => ({
      maintenance: await svc.getMaintenance(userId, Number(maintenanceId)),
    }))
  },

  async addMaintenance(socket: AuthenticatedSocket, maintenance: any, callback: Function) {
    await runMaintenanceSocket(socket, callback, async (svc, userId) => {
      const created = await svc.createMaintenance(userId, maintenance)
      return { maintenance: created, maintenanceID: created.id }
    })
  },

  async editMaintenance(socket: AuthenticatedSocket, maintenance: any, callback: Function) {
    await runMaintenanceSocket(socket, callback, async (svc, userId) => ({
      maintenance: await svc.updateMaintenance(userId, Number(maintenance?.id), maintenance),
    }))
  },

  async deleteMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    await runMaintenanceSocket(socket, callback, async (svc, userId) => {
      await svc.deleteMaintenance(userId, Number(maintenanceId))
      return {}
    })
  },

  async pauseMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    await runMaintenanceSocket(socket, callback, async (svc, userId) => ({
      maintenance: await svc.setMaintenanceActive(userId, Number(maintenanceId), false),
    }))
  },

  async resumeMaintenance(socket: AuthenticatedSocket, maintenanceId: number, callback: Function) {
    await runMaintenanceSocket(socket, callback, async (svc, userId) => ({
      maintenance: await svc.setMaintenanceActive(userId, Number(maintenanceId), true),
    }))
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

  async enableAPIKey(socket: AuthenticatedSocket, keyId: number, callback: Function) {
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

      const updated = await prisma.apiKey.update({
        where: { id: keyId },
        data: { active: true }
      })

      callback({ 
        ok: true, 
        apiKey: {
          id: updated.id,
          name: updated.name,
          active: updated.active,
          expires: updated.expires,
          createdAt: updated.createdAt
        }
      })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async disableAPIKey(socket: AuthenticatedSocket, keyId: number, callback: Function) {
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

      const updated = await prisma.apiKey.update({
        where: { id: keyId },
        data: { active: false }
      })

      callback({ 
        ok: true, 
        apiKey: {
          id: updated.id,
          name: updated.name,
          active: updated.active,
          expires: updated.expires,
          createdAt: updated.createdAt
        }
      })
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
    try {
      if (!dockerHost.dockerDaemon && !dockerHost.connectionUrl) {
        return callback({ ok: false, msg: 'Docker daemon path or connection URL is required' })
      }

      // Dynamic import of dockerode
      const Docker = (await import('dockerode')).default
      let docker

      if (dockerHost.dockerType === 'socket') {
        // Unix socket connection (e.g., /var/run/docker.sock)
        docker = new Docker({ socketPath: dockerHost.dockerDaemon })
      } else {
        // TCP connection
        const tcpUrl = dockerHost.dockerDaemon || dockerHost.connectionUrl
        // Replace tcp:// with http:// for axios compatibility
        const urlStr = tcpUrl.replace(/^tcp:\/\//, 'http://')
        const url = new URL(urlStr)
        docker = new Docker({
          host: url.hostname,
          port: parseInt(url.port) || 2375,
          protocol: (url.protocol.replace(':', '') as 'http' | 'https')
        })
      }

      // Test connection by listing containers
      const containers = await docker.listContainers({ all: true })

      callback({ 
        ok: true, 
        msg: `Connected successfully. Found ${containers.length} containers.`
      })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Node Events (Cluster Management)
  // =====================
  async getNodeList(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const nodes = await prisma.node.findMany({
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'desc' }
        ]
      })

      callback({ ok: true, nodes })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async addNode(socket: AuthenticatedSocket, nodeData: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const { nodeId, nodeName, host, hostname, location, isPrimary } = nodeData

      // Validate required fields
      if (!nodeId || !nodeName) {
        return callback({ ok: false, msg: 'Node ID and Node Name are required' })
      }

      // Check if nodeId already exists
      const existingNode = await prisma.node.findUnique({
        where: { nodeId }
      })

      if (existingNode) {
        return callback({ ok: false, msg: 'A node with this ID already exists' })
      }

      // If this node is set as primary, unset all other primary nodes
      if (isPrimary) {
        await prisma.node.updateMany({
          where: { isPrimary: true },
          data: { isPrimary: false }
        })
      }

      const node = await prisma.node.create({
        data: {
          nodeId,
          nodeName,
          host: host || null,
          hostname: hostname || null,
          location: location || null,
          isPrimary: !!isPrimary,
          status: 'unknown'
        }
      })

      console.log(`[Node] Added node: ${nodeId} (${nodeName}) by user ${socket.userId}`)

      // Broadcast updated node list to all connected clients
      const nodes = await prisma.node.findMany({
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
      })
      io?.emit('nodeList', nodes)

      callback({ ok: true, msg: 'Node added successfully', node })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async updateNode(socket: AuthenticatedSocket, nodeData: any, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const { id, nodeId, nodeName, host, hostname, location, isPrimary } = nodeData

      // Validate required fields
      if (!nodeId || !nodeName) {
        return callback({ ok: false, msg: 'Node ID and Node Name are required' })
      }

      // Find existing node by nodeId
      const existingNode = await prisma.node.findUnique({
        where: { nodeId }
      })

      if (!existingNode) {
        return callback({ ok: false, msg: 'Node not found' })
      }

      // If this node is set as primary, unset all other primary nodes
      if (isPrimary && !existingNode.isPrimary) {
        await prisma.node.updateMany({
          where: { 
            isPrimary: true,
            nodeId: { not: nodeId }
          },
          data: { isPrimary: false }
        })
      }

      const node = await prisma.node.update({
        where: { nodeId },
        data: {
          nodeName,
          host: host || null,
          hostname: hostname || null,
          location: location || null,
          isPrimary: !!isPrimary
        }
      })

      console.log(`[Node] Updated node: ${nodeId} (${nodeName}) by user ${socket.userId}`)

      // Broadcast updated node list to all connected clients
      const nodes = await prisma.node.findMany({
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
      })
      io?.emit('nodeList', nodes)

      callback({ ok: true, msg: 'Node updated successfully', node })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async deleteNode(socket: AuthenticatedSocket, nodeId: number, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      const node = await prisma.node.findUnique({
        where: { id: nodeId }
      })

      if (!node) {
        return callback({ ok: false, msg: 'Node not found' })
      }

      // TODO: Check if any monitors are assigned to this node
      // const assignedMonitors = await prisma.monitor.findMany({
      //   where: { OR: [{ assignedNode: node.nodeId }, { nodeId: node.nodeId }] }
      // })
      // if (assignedMonitors.length > 0) {
      //   return callback({ ok: false, msg: `Cannot delete node. ${assignedMonitors.length} monitor(s) are assigned to this node.` })
      // }

      await prisma.node.delete({ where: { id: nodeId } })

      console.log(`[Node] Deleted node: ${node.nodeId} (${node.nodeName}) by user ${socket.userId}`)

      // Broadcast updated node list to all connected clients
      const nodes = await prisma.node.findMany({
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
      })
      io?.emit('nodeList', nodes)

      callback({ ok: true, msg: 'Node deleted successfully' })
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

      // Stop checking it, keep the members of a deleted group (they move up one level)
      const { stopMonitorJob, scheduleGroupRecheck } = await import('./monitor/scheduler')
      const { releaseChildren } = await import('./workspace/service')
      stopMonitorJob(monitorId)
      await releaseChildren(socket.userId, monitorId, existing.parent)

      // Delete related data
      await prisma.heartbeat.deleteMany({ where: { monitorId } })
      await prisma.monitorTag.deleteMany({ where: { monitorId } })
      await prisma.monitorNotification.deleteMany({ where: { monitorId } })
      await prisma.maintenanceMonitor.deleteMany({ where: { monitorId } })
      await prisma.statusPageMonitor.deleteMany({ where: { monitorId } })
      
      // Delete monitor
      await prisma.monitor.delete({ where: { id: monitorId } })
      scheduleGroupRecheck(existing.parent)

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

      const { stopMonitorJob, scheduleGroupRecheck } = await import('./monitor/scheduler')
      stopMonitorJob(monitorId)
      scheduleGroupRecheck(updated.parent)

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

      const { startMonitorJob, scheduleGroupRecheck } = await import('./monitor/scheduler')
      await startMonitorJob(updated)
      scheduleGroupRecheck(updated.parent)

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
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Import notification sender
      const { sendNotification } = await import('./notification/sender')
      
      // Create a mock monitor and result for testing
      const mockMonitor = {
        id: 0,
        name: 'Test Monitor',
        url: 'https://example.com',
        userId: socket.userId
      }
      
      const mockResult = {
        status: 1, // UP status for test
        ping: 100,
        msg: 'This is a test notification from Uptime Kuma'
      }
      
      // Parse notification config if it's a string
      let config = notification.config
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config)
        } catch {
          // Keep as-is if not valid JSON
        }
      }
      
      // Send the test notification
      await sendNotification(
        { type: notification.type, config },
        mockMonitor,
        mockResult
      )
      
      callback({ ok: true, msg: 'Test notification sent successfully!' })
    } catch (error: any) {
      console.error('[Socket] testNotification error:', error)
      callback({ ok: false, msg: `Failed to send test notification: ${error.message}` })
    }
  },

  // =====================
  // Settings Events
  // =====================
  async getSettings(socket: AuthenticatedSocket, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Get all settings
      const settings = await prisma.setting.findMany()
      
      // Convert to key-value object
      const data: Record<string, any> = {}
      for (const setting of settings) {
        try {
          // Try to parse JSON values
          if (setting.type === 'json' && setting.value) {
            data[setting.key] = JSON.parse(setting.value)
          } else if (setting.type === 'boolean') {
            data[setting.key] = setting.value === 'true'
          } else if (setting.type === 'number' && setting.value) {
            data[setting.key] = parseFloat(setting.value)
          } else {
            data[setting.key] = setting.value
          }
        } catch {
          data[setting.key] = setting.value
        }
      }
      
      // Add server timezone if not set
      if (!data.serverTimezone) {
        data.serverTimezone = process.env.TZ || 'UTC'
      }
      
      callback({ ok: true, data })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async setSettings(socket: AuthenticatedSocket, data: Record<string, any>, currentPassword: string | null, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Check password if disabling auth
      const currentDisabledAuth = await prisma.setting.findFirst({
        where: { key: 'disableAuth' }
      })
      
      if (currentDisabledAuth?.value !== 'true' && data.disableAuth === true) {
        // Need to verify password when disabling auth
        if (!currentPassword) {
          return callback({ ok: false, msg: 'Password is required to disable authentication' })
        }
        
        // Verify password (simplified - should use proper verification)
        const user = await prisma.user.findUnique({
          where: { id: socket.userId }
        })
        
        if (!user) {
          return callback({ ok: false, msg: 'User not found' })
        }
        
        const bcrypt = await import('bcryptjs')
        const valid = await bcrypt.compare(currentPassword, user.password)
        
        if (!valid) {
          return callback({ ok: false, msg: 'Invalid password' })
        }
      }
      
      // Save each setting
      for (const [key, value] of Object.entries(data)) {
        let valueStr: string
        let type = 'string'
        
        if (typeof value === 'boolean') {
          valueStr = value ? 'true' : 'false'
          type = 'boolean'
        } else if (typeof value === 'number') {
          valueStr = value.toString()
          type = 'number'
        } else if (typeof value === 'object' && value !== null) {
          valueStr = JSON.stringify(value)
          type = 'json'
        } else {
          valueStr = value?.toString() ?? ''
        }
        
        await prisma.setting.upsert({
          where: { key },
          update: { value: valueStr, type },
          create: { key, value: valueStr, type }
        })
      }
      
      // Broadcast settings change to all user's sockets
      broadcastSettingsUpdated(socket.userId, data)
      
      callback({ ok: true, msg: 'Settings saved successfully' })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  // =====================
  // Info Event
  // =====================
  async getInfo(socket: AuthenticatedSocket, callback: Function) {
    try {
      const dayjs = (await import('dayjs')).default
      const utc = (await import('dayjs/plugin/utc')).default
      const timezone = (await import('dayjs/plugin/timezone')).default
      dayjs.extend(utc)
      dayjs.extend(timezone)
      
      // Get version from package.json using runtime config
      const version = process.env.npm_package_version || '2.0.0-beta'
      
      // Check if running in container
      const isContainer = process.env.UPTIME_KUMA_IS_CONTAINER === '1' || 
                          process.env.DOCKER === '1' ||
                          Boolean(process.env.KUBERNETES_SERVICE_HOST)
      
      // Get server timezone
      const serverTimezone = dayjs.tz.guess() || 'UTC'
      const serverTimezoneOffset = new Date().getTimezoneOffset() * -1 // In minutes, positive for east
      
      // Get current node info for cluster mode
      const currentNodeId = process.env.UPTIME_KUMA_NODE_ID || process.env.NODE_ID || null
      let currentNode = null
      if (currentNodeId) {
        currentNode = await prisma.node.findFirst({
          where: { nodeId: currentNodeId }
        })
      }
      
      // Get primary base URL setting
      const primaryBaseURLSetting = await prisma.setting.findUnique({
        where: { key: 'primaryBaseURL' }
      })
      const primaryBaseURL = primaryBaseURLSetting?.value || null
      
      // Latest version (would normally come from version check service)
      // For now, set same as current version or check GitHub releases
      let latestVersion = version
      try {
        // Check if we have a cached latest version
        const latestVersionSetting = await prisma.setting.findUnique({
          where: { key: 'latestVersion' }
        })
        if (latestVersionSetting?.value) {
          latestVersion = latestVersionSetting.value
        }
      } catch {
        // Use current version as latest
      }
      
      const info = {
        version,
        latestVersion,
        isContainer,
        dbType: 'postgresql', // Nuxt version uses PostgreSQL
        currentNodeId,
        currentNode: currentNode ? {
          id: currentNode.id,
          nodeId: currentNode.nodeId,
          name: currentNode.nodeName,
          url: currentNode.host,
          isPrimary: currentNode.isPrimary,
          isOnline: currentNode.status === 'online'
        } : null,
        primaryBaseURL,
        serverTimezone,
        serverTimezoneOffset
      }
      
      callback({ ok: true, info })
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
  },

  // =====================
  // Chrome/Browser Testing
  // =====================
  async testChrome(socket: AuthenticatedSocket, executablePath: string, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Try to launch Chrome/Chromium with the given executable path
      // Note: This requires playwright to be installed
      let chromePath = executablePath
      
      if (!chromePath) {
        // Try to find Chrome automatically
        const possiblePaths = [
          // Windows
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
          // Linux
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          // macOS
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ]
        
        const fs = await import('fs')
        for (const path of possiblePaths) {
          if (path && fs.existsSync(path)) {
            chromePath = path
            break
          }
        }
      }

      if (!chromePath) {
        return callback({
          ok: false,
          msg: 'Chrome/Chromium executable not found. Please specify the path manually.'
        })
      }

      // For now, just check if the file exists
      const fs = await import('fs')
      if (!fs.existsSync(chromePath)) {
        return callback({
          ok: false,
          msg: `Chrome executable not found at: ${chromePath}`
        })
      }

      // Try to get version using child_process
      const { execSync } = await import('child_process')
      let version = 'Unknown'
      
      try {
        // Try to get Chrome version
        if (process.platform === 'win32') {
          const output = execSync(`"${chromePath}" --version`, { encoding: 'utf8', timeout: 5000 })
          version = output.trim().replace(/^.*Chrome\s*/, '').trim()
        } else {
          const output = execSync(`"${chromePath}" --version`, { encoding: 'utf8', timeout: 5000 })
          version = output.trim()
        }
      } catch (e) {
        // If we can't get version, just confirm the file exists
        version = 'Found (version check failed)'
      }

      callback({
        ok: true,
        msg: {
          key: 'foundChromiumVersion',
          values: [version]
        },
        msgi18n: true
      })
    } catch (error: any) {
      callback({ ok: false, msg: error.message })
    }
  },

  async testRemoteBrowser(socket: AuthenticatedSocket, remoteBrowserURL: string, callback: Function) {
    if (!socket.userId) {
      return callback({ ok: false, msg: 'Not authenticated' })
    }

    try {
      // Validate URL format
      const url = new URL(remoteBrowserURL)
      if (!url.protocol.startsWith('ws')) {
        return callback({ ok: false, msg: 'Remote browser URL must use WebSocket protocol (ws:// or wss://)' })
      }

      // For now, just validate the URL format
      // Actual connection test would require playwright
      callback({ 
        ok: true, 
        msg: 'Remote browser URL format is valid. Actual connection test requires Playwright.' 
      })
    } catch (error: any) {
      callback({ ok: false, msg: `Invalid URL: ${error.message}` })
    }
  },

  /**
   * Disconnect all other socket clients of the current user
   * This is useful when user wants to log out from all other devices
   */
  async disconnectOtherSocketClients(socket: AuthenticatedSocket) {
    if (!socket.userId) {
      console.log('[Socket.io] Cannot disconnect other clients - user not authenticated')
      return
    }

    try {
      if (!io) {
        console.log('[Socket.io] Socket.io not initialized')
        return
      }

      // Get all sockets in the user's room
      const userRoom = `user_${socket.userId}`
      const sockets = await io.in(userRoom).fetchSockets()

      // Disconnect all sockets except the current one
      let disconnectedCount = 0
      for (const s of sockets) {
        if (s.id !== socket.id) {
          s.emit('refresh')
          s.disconnect(true)
          disconnectedCount++
        }
      }

      console.log(`[Socket.io] Disconnected ${disconnectedCount} other socket clients for user ${socket.userId}`)
    } catch (error: any) {
      console.error('[Socket.io] Error disconnecting other socket clients:', error.message)
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
        
        // Send initial data after login
        const monitorTypeList = getMonitorTypeListForClient()
        socket.emit('monitorTypeList', monitorTypeList)
        
        // Send server info
        socketHandlers.getInfo(socket, (result: any) => {
          if (result.ok) {
            socket.emit('info', result.info)
          }
        })
        
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
    socket.on('getMonitorTypeList', (callback) => socketHandlers.getMonitorTypeList(socket, callback))
    socket.on('getMonitorBeats', (monitorId, period, callback) => socketHandlers.getMonitorBeats(socket, monitorId, period, callback))
    socket.on('monitorImportantHeartbeatListCount', (monitorId, callback) => socketHandlers.getImportantHeartbeatListCount(socket, monitorId, callback))
    socket.on('monitorImportantHeartbeatListPaged', (monitorId, offset, count, callback) => socketHandlers.getImportantHeartbeatListPaged(socket, monitorId, offset, count, callback))
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
    // Settings Event Handlers
    // =====================
    socket.on('getSettings', (callback) => socketHandlers.getSettings(socket, callback))
    socket.on('setSettings', (data, currentPassword, callback) => socketHandlers.setSettings(socket, data, currentPassword, callback))
    socket.on('getInfo', (callback) => socketHandlers.getInfo(socket, callback))

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
    socket.on('enableAPIKey', (keyId, callback) => socketHandlers.enableAPIKey(socket, keyId, callback))
    socket.on('disableAPIKey', (keyId, callback) => socketHandlers.disableAPIKey(socket, keyId, callback))

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
    // Node Event Handlers (Cluster Management)
    // =====================
    socket.on('getNodeList', (callback) => socketHandlers.getNodeList(socket, callback))
    socket.on('addNode', (nodeData, callback) => socketHandlers.addNode(socket, nodeData, callback))
    socket.on('updateNode', (nodeData, callback) => socketHandlers.updateNode(socket, nodeData, callback))
    socket.on('deleteNode', (nodeId, callback) => socketHandlers.deleteNode(socket, nodeId, callback))

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
    socket.on('testChrome', (executablePath, callback) => socketHandlers.testChrome(socket, executablePath, callback))
    socket.on('testRemoteBrowser', (remoteBrowserURL, callback) => socketHandlers.testRemoteBrowser(socket, remoteBrowserURL, callback))
    socket.on('disconnectOtherSocketClients', () => socketHandlers.disconnectOtherSocketClients(socket))

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

/**
 * Broadcast full maintenance list to a user (used when maintenance status changes)
 */
export async function broadcastMaintenanceList(userId: number) {
  if (!io) return
  
  try {
    // Import dynamically to avoid circular dependency
    const { listMaintenances } = await import('./maintenance/service')
    const maintenanceList = await listMaintenances(userId)

    io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
      if (socket.userId === userId) {
        socket.emit('maintenanceList', maintenanceList)
      }
    })
  } catch (error) {
    console.error('[Socket] Error broadcasting maintenance list:', error)
  }
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

// Settings broadcast functions
export function broadcastSettingsUpdated(userId: number, settings: any) {
  if (!io) return
  
  io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
    if (socket.userId === userId) {
      socket.emit('settingsUpdated', settings)
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

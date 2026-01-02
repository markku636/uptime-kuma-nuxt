// API endpoint for exporting all data
import { defineEventHandler, setHeader, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // Fetch all data for export
    const [
      monitors,
      notifications,
      tags,
      statusPages,
      maintenances,
      proxies,
      dockerHosts,
      settings
    ] = await Promise.all([
      prisma.monitor.findMany({
        include: {
          monitorTags: true,
          monitorNotifications: true
        }
      }),
      prisma.notification.findMany(),
      prisma.tag.findMany(),
      prisma.statusPage.findMany({
        include: {
          statusPageMonitors: true
        }
      }),
      prisma.maintenance.findMany({
        include: {
          maintenanceMonitors: true
        }
      }),
      prisma.proxy.findMany(),
      prisma.dockerHost.findMany(),
      prisma.setting.findMany()
    ])

    const exportData = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      monitors: monitors.map(m => ({
        ...m,
        // Remove IDs that will be regenerated
        id: undefined,
        heartbeats: undefined
      })),
      notifications: notifications.map(n => ({
        ...n,
        id: undefined
      })),
      tags,
      statusPages: statusPages.map(sp => ({
        ...sp,
        id: undefined
      })),
      maintenances: maintenances.map(m => ({
        ...m,
        id: undefined
      })),
      proxies: proxies.map(p => ({
        ...p,
        id: undefined
      })),
      dockerHosts: dockerHosts.map(dh => ({
        ...dh,
        id: undefined
      })),
      settings
    }

    // Set response headers for file download
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="uptime-kuma-backup-${new Date().toISOString().split('T')[0]}.json"`)

    return JSON.stringify(exportData, null, 2)
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to export data'
    })
  }
})

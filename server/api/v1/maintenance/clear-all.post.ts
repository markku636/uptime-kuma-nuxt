// API endpoint to clear all data (dangerous!)
import { defineEventHandler, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // Delete all data in order (respecting foreign keys)
    await prisma.$transaction(async (tx) => {
      // Delete heartbeats first
      await tx.heartbeat.deleteMany()
      
      // Delete monitor-related data
      await tx.monitorTag.deleteMany()
      await tx.monitorNotification.deleteMany()
      await tx.statusPageMonitor.deleteMany()
      await tx.maintenanceMonitor.deleteMany()
      
      // Delete monitors
      await tx.monitor.deleteMany()
      
      // Delete status pages
      await tx.statusPage.deleteMany()
      
      // Delete maintenances
      await tx.maintenance.deleteMany()
      
      // Delete notifications
      await tx.notification.deleteMany()
      
      // Delete tags
      await tx.tag.deleteMany()
      
      // Delete proxies
      await tx.proxy.deleteMany()
      
      // Delete Docker hosts
      await tx.dockerHost.deleteMany()
      
      // Keep settings but reset some values
      await tx.setting.deleteMany({
        where: {
          key: {
            notIn: ['primaryBaseURL', 'timezone']
          }
        }
      })
    })

    return {
      success: true,
      message: 'All data cleared successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to clear all data'
    })
  }
})

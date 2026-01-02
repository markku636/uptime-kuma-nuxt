// API endpoint for status page heartbeat (public endpoint for push monitoring)
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Status page slug is required'
    })
  }

  try {
    // Find the status page
    const statusPage = await prisma.statusPage.findFirst({
      where: { slug },
      include: {
        statusPageMonitors: {
          include: {
            monitor: {
              include: {
                heartbeats: {
                  take: 50,
                  orderBy: { time: 'desc' }
                }
              }
            }
          }
        }
      }
    })

    if (!statusPage) {
      throw createError({
        statusCode: 404,
        message: 'Status page not found'
      })
    }

    if (!statusPage.published) {
      throw createError({
        statusCode: 403,
        message: 'Status page is not published'
      })
    }

    // Calculate overall status
    const monitors = statusPage.statusPageMonitors.map(spm => ({
      id: spm.monitor.id,
      name: spm.monitor.name,
      type: spm.monitor.type,
      status: getMonitorStatus(spm.monitor.heartbeats),
      uptime: calculateUptime(spm.monitor.heartbeats),
      heartbeats: spm.monitor.heartbeats.map(hb => ({
        status: hb.status,
        time: hb.time,
        ping: hb.ping,
        msg: hb.msg
      }))
    }))

    const overallStatus = calculateOverallStatus(monitors)

    return {
      slug: statusPage.slug,
      title: statusPage.title,
      description: statusPage.description,
      theme: statusPage.theme,
      published: statusPage.published,
      showTags: statusPage.showTags,
      domainNameList: statusPage.domainNameList,
      customCSS: statusPage.customCSS,
      footerText: statusPage.footerText,
      showPoweredBy: statusPage.showPoweredBy,
      icon: statusPage.icon,
      overallStatus,
      monitors,
      lastUpdated: new Date().toISOString()
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch status page heartbeat'
    })
  }
})

function getMonitorStatus(heartbeats: any[]): number {
  if (!heartbeats.length) return 2 // pending
  return heartbeats[0].status
}

function calculateUptime(heartbeats: any[]): number {
  if (!heartbeats.length) return 0
  
  const upBeats = heartbeats.filter(hb => hb.status === 1).length
  return (upBeats / heartbeats.length) * 100
}

function calculateOverallStatus(monitors: any[]): string {
  if (!monitors.length) return 'unknown'
  
  const hasDown = monitors.some(m => m.status === 0)
  const hasMaintenance = monitors.some(m => m.status === 3)
  const hasPending = monitors.some(m => m.status === 2)
  const allUp = monitors.every(m => m.status === 1)
  
  if (hasMaintenance) return 'maintenance'
  if (hasDown) {
    const downCount = monitors.filter(m => m.status === 0).length
    if (downCount === monitors.length) return 'major-outage'
    if (downCount > monitors.length / 2) return 'partial-outage'
    return 'degraded'
  }
  if (hasPending) return 'degraded'
  if (allUp) return 'operational'
  
  return 'unknown'
}

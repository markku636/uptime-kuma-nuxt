import type { H3Event } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {parseMonitorIds,recentHeartbeats} from './monitor-query'
import {rawUptimeWindows} from '../services/uptime/queries'
import { getRequestSession } from './request-session'

export async function visibleStatusPage(event: H3Event) {
  const slug = getRouterParam(event, 'slug')
  const page = slug && await prisma.statusPage.findUnique({ where: { slug } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  if (!page.published) {
    try {
      const session = await getRequestSession(event)
      if (!session.user || !('workspaceId' in session) || session.workspaceId !== page.workspaceId) throw new Error('No access')
    } catch { throw createError({ statusCode: 404, message: 'Status page not found' }) }
  }
  return page
}
export async function assertPublishedMonitor(id: number) {
  const monitor = await prisma.monitor.findUnique({ where: { id }, select: { workspaceId: true,
    statusPageMonitors: { select: { group: { select: { statusPage: { select: { published: true, workspaceId: true } } } } } } } })
  if (!monitor || !monitor.statusPageMonitors.some(link => link.group.statusPage.published && link.group.statusPage.workspaceId === monitor.workspaceId)) {
    throw createError({ statusCode: 404, message: 'Monitor not found' })
  }
}
export function statusConfig(page: any) {
  return { id: page.id, slug: page.slug, title: page.title, description: page.description,
    icon: page.icon, theme: page.theme, published: page.published, showTags: page.showTags,
    showPoweredBy: page.showPoweredBy, showCertificateExpiry: page.showCertificateExpiry,
    perPage: page.perPage, autoRefreshInterval: page.autoRefreshInterval, customCSS: page.customCss,
    customCss: page.customCss, footerText: page.footerText, googleAnalyticsId: page.googleAnalyticsId }
}

export const publicHeartbeatHandler = defineEventHandler(async (event: H3Event) => {
  const page = await visibleStatusPage(event)
  const requested = getQuery(event).monitorIds
  const ids=requested?parseMonitorIds(requested):null
  const links = await prisma.statusPageMonitor.findMany({ where: { group: { statusPageId: page.id },
    monitor: { workspaceId: page.workspaceId }, ...(ids ? { monitorId: { in: ids } } : {}) }, select: { monitorId: true }, take: ids?200:201 })
  if(!ids&&links.length>200)throw createError({statusCode:400,message:'Provide monitorIds from the visible status-page page'})
  const monitorIds = [...new Set(links.map(x => x.monitorId))]
  if(ids&&monitorIds.length!==ids.length)throw createError({statusCode:404,message:'Monitor not found on this status page'})
  const heartbeatList: Record<number, { status: number; time: string; ping: number | null }[]> = {}
  const uptimeList: Record<string, number | null> = {}
  if (monitorIds.length) {
    const rows=await recentHeartbeats(monitorIds,50)
    for(const row of rows)(heartbeatList[row.monitorId]||=[]).unshift({status:row.status,time:row.time.toISOString(),ping:row.ping})
    const end=new Date(),uptime=await rawUptimeWindows(monitorIds,[{key:'24',start:new Date(end.getTime()-86400000),end}])
    for(const id of monitorIds)uptimeList[`${id}_24`]=uptime.get(`${id}:24`)?.uptime??null
  }
  return { ok: true, data: { heartbeatList, uptimeList }, heartbeatList, uptimeList,
    heartbeats: heartbeatList, uptime: uptimeList, timestamp: new Date().toISOString() }
})

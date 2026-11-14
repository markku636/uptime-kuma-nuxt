import type { H3Event } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
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
  const ids = requested ? String(requested).split(',').slice(0, 200).map(Number).filter(Number.isSafeInteger) : null
  const links = await prisma.statusPageMonitor.findMany({ where: { group: { statusPageId: page.id },
    monitor: { workspaceId: page.workspaceId }, ...(ids ? { monitorId: { in: ids } } : {}) }, select: { monitorId: true }, take: 200 })
  const monitorIds = [...new Set(links.map(x => x.monitorId))]
  const heartbeatList: Record<number, { status: number; time: string; ping: number | null }[]> = {}
  const uptimeList: Record<string, number | null> = {}
  if (monitorIds.length) {
    const rows = await prisma.$queryRaw<{ monitor_id: number; status: number; time: Date; ping: number | null }[]>(Prisma.sql`
      SELECT monitor_id,status,time,ping FROM (
        SELECT monitor_id,status,time,ping,row_number() OVER(PARTITION BY monitor_id ORDER BY time DESC,id DESC) AS n
        FROM heartbeats WHERE monitor_id IN (${Prisma.join(monitorIds)})
      ) h WHERE n<=50 ORDER BY monitor_id,time ASC`)
    for (const row of rows) (heartbeatList[row.monitor_id] ||= []).push({ status: row.status, time: row.time.toISOString(), ping: row.ping })
    // Weight status by elapsed time; unknown/maintenance periods are not counted as UP.
    const uptime = await prisma.$queryRaw<{ monitor_id: number; uptime: number | null }[]>(Prisma.sql`
      WITH prior AS (SELECT DISTINCT ON(monitor_id) monitor_id,status,time FROM heartbeats
        WHERE monitor_id IN (${Prisma.join(monitorIds)}) AND time < NOW()-INTERVAL '24 hours' ORDER BY monitor_id,time DESC),
      recent AS (SELECT monitor_id,status,time FROM heartbeats WHERE monitor_id IN (${Prisma.join(monitorIds)}) AND time >= NOW()-INTERVAL '24 hours'),
      windows AS (SELECT monitor_id,status,GREATEST(time,NOW()-INTERVAL '24 hours') AS start,
        LEAD(time,1,NOW()) OVER(PARTITION BY monitor_id ORDER BY time) AS finish FROM (SELECT * FROM prior UNION ALL SELECT * FROM recent) h)
      SELECT monitor_id, (100.0*SUM(EXTRACT(EPOCH FROM finish-start)) FILTER(WHERE status=1)
        /NULLIF(SUM(EXTRACT(EPOCH FROM finish-start)) FILTER(WHERE status IN(0,1)),0))::float8 AS uptime
      FROM windows GROUP BY monitor_id`)
    for (const row of uptime) uptimeList[`${row.monitor_id}_24`] = row.uptime
  }
  return { ok: true, data: { heartbeatList, uptimeList }, heartbeatList, uptimeList,
    heartbeats: heartbeatList, uptime: uptimeList, timestamp: new Date().toISOString() }
})

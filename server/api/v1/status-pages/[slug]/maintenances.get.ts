import { visibleStatusPage } from '../../../../utils/public-status'
import { maintenanceToPublicJSON } from '../../../../services/maintenance/scheduler'
import { prisma } from '~/server/utils/prisma'

/** Public, password-aware list of upcoming/active maintenance windows for a status page. */
export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug is required' })
  const page = await visibleStatusPage(event)
  const links = await prisma.maintenanceStatusPage.findMany({
    where: { statusPageId: page.id, maintenance: { active: true } },
    include: { maintenance: true },
    take: 20,
  })
  const rows = await Promise.all(links.map(link => maintenanceToPublicJSON(link.maintenance)))
  return {
    ok: true,
    data: rows
      .filter(row => row.status === 'under-maintenance' || row.status === 'scheduled')
      .sort((a, b) => new Date(a.startDate || a.timeslotList?.[0]?.startDate || 0).getTime() - new Date(b.startDate || b.timeslotList?.[0]?.startDate || 0).getTime())
      .slice(0, 10),
  }
})

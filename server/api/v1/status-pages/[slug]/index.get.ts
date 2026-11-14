import { statusConfig, visibleStatusPage } from '../../../../utils/public-status'
export default defineEventHandler(async event => {
  const page = await visibleStatusPage(event)
  const groups = await prisma.statusPageGroup.findMany({ where: { statusPageId: page.id }, orderBy: { weight: 'asc' }, take: 100,
    include: { monitors: { where: { monitor: { workspaceId: page.workspaceId } }, take: 200,
      select: { id: true, monitorId: true, sendUrl: true, monitor: { select: { id: true, name: true, type: true, active: true } } } } } })
  const incidents = await prisma.incident.findMany({ where: { statusPageId: page.id, pin: true }, orderBy: { createdAt: 'desc' }, take: 20 })
  return { ok: true, data: { ...statusConfig(page), groups, incidents } }
})

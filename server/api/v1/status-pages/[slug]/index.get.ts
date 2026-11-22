import { statusConfig, visibleStatusPage } from '../../../../utils/public-status'
import { getRequestSession } from '../../../../utils/request-session'
export default defineEventHandler(async event => {
  const page = await visibleStatusPage(event)
  const groups = await prisma.statusPageGroup.findMany({ where: { statusPageId: page.id }, orderBy: { weight: 'asc' }, take: 100,
    include: { monitors: { where: { monitor: { workspaceId: page.workspaceId } }, take: 200,
      select: { id: true, monitorId: true, sendUrl: true, monitor: { select: { id: true, name: true, type: true, active: true } } } } } })
  const incidents = await prisma.incident.findMany({ where: { statusPageId: page.id, pin: true }, orderBy: { createdAt: 'desc' }, take: 20 })
  let canEdit = false
  try {
    const session = await getRequestSession(event)
    canEdit = !!session.user && 'workspaceId' in session && session.workspaceId === page.workspaceId
      && ['owner', 'editor'].includes((session as { role?: string }).role || '')
  } catch { canEdit = false }
  return { ok: true, data: { ...statusConfig(page), canEdit, groups, incidents } }
})

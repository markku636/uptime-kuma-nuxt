import { requireWorkspace } from '../../../../utils/workspace'

export default defineEventHandler(async (event) => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId, type: 'push' },
    select: { pushToken: true },
  })
  if (!monitor?.pushToken) throw createError({ statusCode: 404, message: 'Push monitor not found' })
  return { ok: true, url: `${getRequestURL(event).origin}/api/push/${monitor.pushToken}` }
})

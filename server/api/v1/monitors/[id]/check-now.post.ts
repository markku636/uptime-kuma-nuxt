import { requireWorkspace } from '../../../../utils/workspace'
import { supportedScheduledTypes } from '../../../../services/monitor/runtime-config'

export default defineEventHandler(async (event) => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true, active: true, type: true, nextCheckAt: true },
  })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })
  if (!monitor.active) throw createError({ statusCode: 409, message: 'Resume the monitor first' })
  if (!supportedScheduledTypes.includes(monitor.type as any)) {
    throw createError({ statusCode: 400, message: 'This monitor type is not scheduled in this deployment' })
  }
  await prisma.monitor.update({
    where: { id },
    data: { nextCheckAt: new Date(Date.now() - 1000) },
  })
  return { ok: true, message: 'Check queued' }
})

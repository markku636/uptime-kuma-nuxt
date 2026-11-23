import { requireWorkspace } from '../../../../utils/workspace'
import { supportedScheduledTypes } from '../../../../services/monitor/runtime-config'
import { trialMonitor } from '../../../../utils/monitor-trial'

export default defineEventHandler(async (event) => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
  })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })
  if (!supportedScheduledTypes.includes(monitor.type as any)) {
    throw createError({ statusCode: 400, message: 'This monitor type is not scheduled in this deployment' })
  }
  if (!monitor.active) {
    // Paused monitors never enter the scheduler queue: run one bounded check on demand.
    const result = await trialMonitor(scope.user.id, monitor)
    return { ok: true, message: 'Check completed', data: result.data }
  }
  if (monitor.leaseOwner && monitor.leaseUntil && monitor.leaseUntil.getTime() > Date.now()) {
    throw createError({ statusCode: 409, message: 'A check is already running for this monitor' })
  }
  await prisma.monitor.update({
    where: { id },
    data: { nextCheckAt: new Date(Date.now() - 1000) },
  })
  return { ok: true, message: 'Check queued' }
})

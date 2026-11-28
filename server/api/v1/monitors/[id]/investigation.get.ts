import { prisma } from '../../../../utils/prisma'
import { requireRequestSession } from '../../../../utils/request-session'
import { buildInvestigationBundle } from '../../../../services/monitor/investigation'

export default defineEventHandler(async event => {
  const scope = await requireRequestSession(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const bundle = await buildInvestigationBundle(id, scope.workspaceId, scope.environmentId, prisma)
  if (!bundle) throw createError({ statusCode: 404, message: 'Monitor not found' })
  return { ok: true, data: bundle }
})

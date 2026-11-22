import { requireRequestSession } from '../../../utils/request-session'
import { getTrackedSessionId, revokeTrackedSession } from '../../../utils/tracked-sessions'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const id = getRouterParam(event, 'id')
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id) || id === 'current') {
    throw createError({ statusCode: 400, message: 'Invalid session id' })
  }
  const currentId = getTrackedSessionId(event)
  if (id === currentId) {
    throw createError({ statusCode: 400, message: 'Use logout to end the current session' })
  }
  const result = await revokeTrackedSession(id, session.user.id)
  if (!result.count) throw createError({ statusCode: 404, message: 'Session not found' })
  return { ok: true }
})

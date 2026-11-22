import { requireRequestSession } from '../../utils/request-session'
import { getTrackedSessionId } from '../../utils/tracked-sessions'
import { signSocketTicket } from '../../utils/socket-ticket'

export default defineEventHandler(async (event) => {
  const { user, workspaceId, environmentId } = await requireRequestSession(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { ticket: signSocketTicket({
    userId: user.id,
    sessionVersion: user.sessionVersion,
    workspaceId,
    environmentId,
    sessionId: getTrackedSessionId(event),
  }, useRuntimeConfig().session.password) }
})

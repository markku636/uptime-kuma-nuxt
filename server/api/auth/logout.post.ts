import { disconnectSessionSockets } from '../../services/socket'
import { getTrackedSessionId, revokeTrackedSession } from '../../utils/tracked-sessions'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const currentId = getTrackedSessionId(event)
  if (currentId) await revokeTrackedSession(currentId, session.user.id)
  // Only this tracked session is revoked; bumping sessionVersion here would
  // silently log out every other device. Use /api/auth/sessions/revoke-all for that.
  disconnectSessionSockets(session.user.id, currentId ?? undefined)
  await clearUserSession(event)
  return { ok: true, message: 'Logged out successfully' }
})

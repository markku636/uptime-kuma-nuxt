import { requireRequestSession } from '../../../utils/request-session'
import { getTrackedSessionId, revokeAllTrackedSessions } from '../../../utils/tracked-sessions'
import { disconnectUserSockets } from '../../../services/socket'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const currentId = getTrackedSessionId(event)
  await revokeAllTrackedSessions(session.user.id, currentId)

  // Reissue this cookie with the bumped version so every other cookie is
  // rejected immediately, even if it was issued before session tracking.
  const updated = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, timezone: true, sessionVersion: true },
  })
  if (!updated) throw createError({ statusCode: 401, message: 'Session is no longer valid' })
  const nextVersion = updated.sessionVersion + 1
  await prisma.user.update({ where: { id: updated.id }, data: { sessionVersion: nextVersion } })
  await setUserSession(event, {
    sessionId: currentId,
    user: {
      id: updated.id,
      username: updated.username,
      timezone: updated.timezone,
      sessionVersion: nextVersion,
    },
  })
  disconnectUserSockets(updated.id)
  return { ok: true }
})

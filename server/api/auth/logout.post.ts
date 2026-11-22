import { disconnectUserSockets } from '../../services/socket'
import { getTrackedSessionId, revokeTrackedSession } from '../../utils/tracked-sessions'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const currentId = getTrackedSessionId(event)
  if (currentId) await revokeTrackedSession(currentId, session.user.id)
  await prisma.user.update({ where: { id: session.user.id }, data: { sessionVersion: { increment: 1 } } })
  disconnectUserSockets(session.user.id)
  await clearUserSession(event)
  return { ok: true, message: 'Logged out successfully' }
})

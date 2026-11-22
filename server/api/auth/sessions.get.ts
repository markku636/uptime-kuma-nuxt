import { requireRequestSession } from '../../utils/request-session'
import { getTrackedSessionId, listTrackedSessions } from '../../utils/tracked-sessions'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  const rows = await listTrackedSessions(session.user.id, getTrackedSessionId(event))
  if (!rows.some(row => row.current)) {
    // A cookie issued before session tracking was introduced: show it as the
    // current session but do not pretend the old row is revocable.
    rows.unshift({
      id: 'current',
      userAgent: getHeader(event, 'user-agent') || 'Unknown',
      ip: getRequestIP(event) || 'Unknown',
      createdAt: new Date(),
      lastActive: new Date(),
      current: true,
    })
  }
  return rows
})

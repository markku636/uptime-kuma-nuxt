import { disconnectUserSockets } from '../../services/socket'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  await prisma.user.update({ where: { id: session.user.id }, data: { sessionVersion: { increment: 1 } } })
  disconnectUserSockets(session.user.id)
  await clearUserSession(event)
  return { ok: true, message: 'Logged out successfully' }
})

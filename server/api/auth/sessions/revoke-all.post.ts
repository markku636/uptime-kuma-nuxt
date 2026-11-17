// server/api/auth/sessions/revoke-all.post.ts
// Log out every other session of the user (other browsers / devices).
import { revokeOtherSessions } from '~/server/services/auth/session-revocation'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session as any).apiKeyId != null) throw createError({ statusCode: 403, message: 'Log in to manage sessions' })
  await revokeOtherSessions(event, userId)
  return { success: true }
})

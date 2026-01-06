// server/api/auth/sessions.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  // Get current session ID from cookie or header
  const currentSessionId = getCookie(event, 'session_id') || ''

  // Try to get sessions from database if session table exists
  try {
    const sessions = await prisma.$queryRaw`
      SELECT id, user_agent as userAgent, ip, last_active as lastActive, created_at as createdAt
      FROM session
      WHERE user_id = ${session.user.id}
      ORDER BY last_active DESC
      LIMIT 10
    ` as any[]

    return sessions.map((s: any) => ({
      ...s,
      current: s.id === currentSessionId
    }))
  } catch (error) {
    // If session table doesn't exist, return mock current session
    return [{
      id: currentSessionId || 'current',
      userAgent: getHeader(event, 'user-agent') || 'Unknown',
      ip: getRequestIP(event) || 'Unknown',
      lastActive: new Date().toISOString(),
      current: true
    }]
  }
})

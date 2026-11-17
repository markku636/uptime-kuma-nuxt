// server/middleware/auth.ts
import { isSessionRevoked } from '../services/auth/session-revocation'
export default defineEventHandler(async (event) => {
  // Skip auth for public routes
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/setup',
    '/api/entry-page',
    '/api/status/',
    '/api/push/',
    '/api/badge/',
    '/api/health',
    '/api/cluster/',      // 叢集節點 API (需要公開給前端)
    '/api/node-info',
  ]

  const path = event.path || ''
  const method = event.method || 'GET'
  
  // Check if current route is public
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route))
  
  if (isPublicRoute) {
    return
  }

  // Public status page routes (GET only for viewing)
  // Pattern: /api/v1/status-pages/{slug}/monitors or /api/v1/status-pages/{slug}/heartbeat
  if (method === 'GET' && path.match(/^\/api\/v1\/status-pages\/[^\/]+\/(monitors|heartbeat)/)) {
    return
  }

  // Check if route requires authentication
  if (path.startsWith('/api/')) {
    let revoked = false
    try {
      const session = await getUserSession(event)
      if (!session?.user) {
        throw createError({
          statusCode: 401,
          message: 'Unauthorized'
        })
      }
      // Logged out from another session ("log out other sessions", password change)
      revoked = await isSessionRevoked(session as any)
    } catch (error) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }
    if (revoked) {
      await clearUserSession(event).catch(() => {})
      throw createError({ statusCode: 401, message: 'Session ended: please log in again' })
    }
  }
})

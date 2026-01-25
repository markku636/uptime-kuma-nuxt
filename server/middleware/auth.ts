// server/middleware/auth.ts
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
    try {
      const session = await getUserSession(event)
      if (!session?.user) {
        throw createError({
          statusCode: 401,
          message: 'Unauthorized'
        })
      }
    } catch (error) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }
  }
})

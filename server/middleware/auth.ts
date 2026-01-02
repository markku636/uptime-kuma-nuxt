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
  ]

  const path = event.path || ''
  
  // Check if current route is public
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route))
  
  if (isPublicRoute) {
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

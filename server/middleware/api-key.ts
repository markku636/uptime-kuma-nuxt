// server/middleware/api-key.ts
import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only apply to API routes
  if (!path.startsWith('/api/v1/')) {
    return
  }

  // Check for API key in headers
  const apiKey = getHeader(event, 'X-API-Key') || getHeader(event, 'Authorization')?.replace('Bearer ', '')

  if (apiKey?.startsWith('uk_')) {
    // Validate API key
    const key = await prisma.apiKey.findFirst({
      where: {
        key: apiKey,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        user: true
      }
    })

    if (key) {
      // Set user context for downstream handlers
      event.context.apiKeyUser = key.user
      event.context.isApiKeyAuth = true
    }
  }
})

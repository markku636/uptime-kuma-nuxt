// server/middleware/api-key.ts
// Authenticates /api/v1/* requests that carry `X-API-Key: uk_...` or `Authorization: Bearer uk_...`.
//
// Runs before auth.ts (Nitro orders middleware by file name). On success it seeds h3's
// per-request session cache with the key owner, so the existing getUserSession /
// requireUserSession calls in auth.ts and in every handler resolve to that user. The
// session is never updated, so no cookie is issued.
import { prisma } from '../utils/prisma'
import { checkApiKey, extractApiKey, isApiKeyPath, isForbiddenForApiKey } from '../services/auth/api-key'

const SESSION_NAME = 'nuxt-session'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!isApiKeyPath(path)) return

  const apiKey = extractApiKey({
    xApiKey: getHeader(event, 'x-api-key'),
    authorization: getHeader(event, 'authorization'),
  })
  if (!apiKey) return

  if (isForbiddenForApiKey(path)) {
    throw createError({ statusCode: 403, message: 'API keys cannot manage API keys; log in instead' })
  }

  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    select: {
      id: true,
      active: true,
      expires: true,
      user: { select: { id: true, username: true, timezone: true, active: true } },
    },
  })

  const check = checkApiKey(key)
  if (!check.ok || !key?.user) {
    // Do not fall back to cookie auth: a caller that sent a key expects key auth.
    throw createError({ statusCode: 401, message: check.ok ? 'Invalid API key' : check.reason })
  }

  const user = { id: key.user.id, username: key.user.username, timezone: key.user.timezone }

  event.context.sessions ??= Object.create(null)
  event.context.sessions[SESSION_NAME] = {
    id: `api-key:${key.id}`,
    createdAt: Date.now(),
    data: { user, apiKeyId: key.id },
  }
  event.context.apiKeyUser = user
  event.context.isApiKeyAuth = true
})

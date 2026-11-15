import { requireRequestSession, requirePlatformAdmin } from '../utils/request-session'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  const method = event.method
  if (!path.startsWith('/api/')) return
  if (method === 'POST' && ['/api/auth/login', '/api/auth/setup'].includes(path)) return
  if (method === 'GET' && ['/api/health', '/api/v1/health', '/api/health/live', '/api/health/ready', '/api/entry-page'].includes(path)) return
  if (method === 'GET' && (/^\/api\/(status\/|badge\/|status-page\/)/.test(path)
    || /^\/api\/v1\/status-pages?\/[^/]+(?:\/(monitors|heartbeat))?$/.test(path))) return
  if (['GET', 'POST'].includes(method) && /^\/api\/push\/[^/]+$/.test(path)) return
  const session = await requireRequestSession(event)
  if (/^\/api\/(cluster(?:\/|$)|node-info$|cloudflared\/|settings\/)/.test(path)
    || /^\/api\/v1\/(users(?:\/|$)|nodes(?:\/|$)|settings\/|maintenance\/shrink-database)/.test(path)
    || path === '/api/metrics') {
    await requirePlatformAdmin(event)
  }
})

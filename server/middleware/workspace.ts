import { requireWorkspace } from '../utils/workspace'

export default defineEventHandler(async event => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/v1/') || ['/api/v1/health', '/api/v1/workspaces'].includes(path)) return
  if (event.method === 'GET' && /^\/api\/v1\/status-pages?\/[^/]+(?:\/(monitors|heartbeat|incidents|config))?$/.test(path)) return
  if (event.method === 'POST' && /^\/api\/v1\/status-pages\/[^/]+\/unlock$/.test(path)) return
  if (/^\/api\/v1\/(nodes|settings|users)(?:\/|$)/.test(path)) return
  await requireWorkspace(event, ['GET', 'HEAD', 'OPTIONS'].includes(event.method) ? 'viewer' : 'editor')
})

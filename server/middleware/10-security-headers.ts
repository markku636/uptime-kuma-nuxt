// server/middleware/10-security-headers.ts
// 基本回應標頭加固。Security scan 對本站的實測發現缺 X-Content-Type-Options／Referrer-Policy／X-Frame-Options。
// Nuxt 需要 inline script/style，因此 CSP 明確允許 unsafe-inline（仍比完全沒有 CSP 好）。
// /status/<slug>/embed 供第三方 iframe 嵌入，因此不設 X-Frame-Options／frame-ancestors，其餘標頭仍套用。

const EMBED_PATH = /^\/status\/[^/]+\/embed(?:\/|\?|$)/
const CSP = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: https:",
  "worker-src 'self' blob:",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname
  const headers = event.node.res
  if (!headers.headersSent) {
    headers.setHeader('X-Content-Type-Options', 'nosniff')
    headers.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if (!EMBED_PATH.test(path)) {
      headers.setHeader('X-Frame-Options', 'DENY')
      headers.setHeader('Content-Security-Policy', CSP)
    }
  }
})

// server/middleware/10-security-headers.ts
// 基本回應標頭加固。Security scan 對本站的實測發現缺 X-Content-Type-Options／Referrer-Policy／X-Frame-Options。
// 刻意不送 CSP：Nuxt 需要 inline script/style， violate 會直接壞站；先用 report-only 觀察（見下述）。
// /status/<slug>/embed 供第三方 iframe 嵌入，因此不設 X-Frame-Options，其餘標頭仍套用。

const EMBED_PATH = /^\/status\/[^/]+\/embed(?:\/|\?|$)/

export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname
  const headers = event.node.res
  if (!headers.headersSent) {
    headers.setHeader('X-Content-Type-Options', 'nosniff')
    headers.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if (!EMBED_PATH.test(path)) headers.setHeader('X-Frame-Options', 'DENY')
  }
})

interface Entry { count: number; resetAt: number }
const entries = new Map<string,Entry>()
const cleanup = setInterval(() => { const now = Date.now(); for (const [key,value] of entries) if (value.resetAt <= now) entries.delete(key) },60_000)
cleanup.unref()
const limit = (name: string, fallback: number) => {
  const value = Number(process.env[name]); return Number.isSafeInteger(value) && value > 0 ? value : fallback
}
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || ['/api/health','/api/v1/health','/api/health/live','/api/health/ready'].includes(path)) return
  const login = ['/api/auth/login','/api/auth/setup'].includes(path)
  const twofa = path.startsWith('/api/auth/2fa/')
  const unlock = /^\/api\/v1\/status-pages\/[^/]+\/unlock$/.test(path)
  const maximum = login || unlock ? limit('LOGIN_RATE_LIMIT',20) : twofa ? limit('TWOFA_RATE_LIMIT',30) : limit('API_RATE_LIMIT',600)
  // Forwarded headers are trusted only when the deployment explicitly trusts its ingress.
  const ip = process.env.TRUST_PROXY_HEADERS === 'true'
    ? getHeader(event,'x-forwarded-for')?.split(',')[0]?.trim() || event.node.req.socket.remoteAddress
    : event.node.req.socket.remoteAddress
  const userId = event.context.requestSession?.user?.id
  const subject = !login && !twofa && userId ? `user:${userId}` : `ip:${ip || 'unknown'}`
  const key = `${login?'login':twofa?'2fa':'api'}:${subject}`, now = Date.now()
  let entry = entries.get(key)
  if (!entry || entry.resetAt <= now) {
    if (entries.size >= 10000) entries.delete(entries.keys().next().value!)
    entry = {count:0,resetAt:now+60_000}; entries.set(key,entry)
  }
  entry.count++
  setResponseHeader(event,'X-RateLimit-Limit',maximum)
  setResponseHeader(event,'X-RateLimit-Remaining',Math.max(0,maximum-entry.count))
  if (entry.count > maximum) {
    setResponseHeader(event,'Retry-After',Math.ceil((entry.resetAt-now)/1000))
    throw createError({ statusCode:429, message:'Too many requests; try again shortly' })
  }
})

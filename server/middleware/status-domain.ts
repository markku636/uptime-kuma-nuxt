// server/middleware/status-domain.ts
// A status page's custom domains: opening "/" on one of them shows that
// status page (as in uptime-kuma). The domain list is cached for 30 s.
import { prisma } from '../utils/prisma'

let cache: { map: Map<string, string>; until: number } | null = null

async function domainMap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (cache && now < cache.until) return cache.map
  const map = new Map<string, string>()
  const pages = await prisma.statusPage.findMany({
    where: { published: true },
    select: { slug: true, domainNameList: true },
  }).catch(() => [])
  for (const page of pages) {
    let list: unknown = page.domainNameList
    // Older versions saved a JSON string
    if (typeof list === 'string') {
      try { list = JSON.parse(list) } catch { list = [] }
    }
    if (Array.isArray(list)) {
      for (const host of list as unknown[]) {
        if (typeof host === 'string' && host) map.set(host.toLowerCase(), page.slug)
      }
    }
  }
  cache = { map, until: now + 30_000 }
  return map
}

/** For the save route: forget the cached domains */
export function invalidateStatusDomains() {
  cache = null
}

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return
  const path = getRequestURL(event).pathname
  if (path !== '/') return
  const host = (getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '')
    .split(',')[0].trim().toLowerCase()
  if (!host) return
  const map = await domainMap()
  if (!map.size) return
  // With or without the port
  const slug = map.get(host) ?? map.get(host.replace(/:\d+$/, ''))
  if (slug) return sendRedirect(event, `/status/${encodeURIComponent(slug)}`, 302)
})

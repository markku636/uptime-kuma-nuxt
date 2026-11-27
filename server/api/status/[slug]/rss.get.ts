import RSS from 'rss'
import { visibleStatusPage } from '../../../utils/public-status'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Status page slug is required'
    })
  }

  // Reuse the public gate so password-protected pages cannot leak via RSS.
  const statusPage = await visibleStatusPage(event)
  const incidents = await prisma.incident.findMany({
    where: { statusPageId: statusPage.id, pin: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { updates: { orderBy: { createdAt: 'desc' }, take: 20 } },
  })

  // Generate RSS feed
  const baseUrl = getRequestURL(event).origin
  
  const feed: any = new RSS({
    title: `${statusPage.title} - Status Updates`,
    description: statusPage.description || `Status updates for ${statusPage.title}`,
    feed_url: `${baseUrl}/api/status/${slug}/rss`,
    site_url: `${baseUrl}/status/${slug}`,
    language: 'en',
    pubDate: new Date(),
    ttl: 5
  })

  // Add incidents to feed
  for (const incident of incidents) {
    const timeline = (incident.updates || [])
      .map((update: any) => `${update.status.toUpperCase()}: ${update.message} (${update.createdAt.toISOString()})`)
      .join('\n')
    feed.item({
      title: incident.title,
      description: [incident.content, timeline].filter(Boolean).join('\n\n'),
      url: `${baseUrl}/status/${slug}#incident-${incident.id}`,
      date: incident.updatedAt || incident.createdAt,
      guid: `incident-${incident.id}`
    })
  }

  // Set content type
  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  
  return feed.xml({ indent: true })
})

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
    where: { statusPageId: statusPage.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
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
    feed.item({
      title: incident.title,
      description: incident.content,
      url: `${baseUrl}/status/${slug}#incident-${incident.id}`,
      date: incident.createdAt,
      guid: `incident-${incident.id}`
    })
  }

  // Set content type
  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  
  return feed.xml({ indent: true })
})

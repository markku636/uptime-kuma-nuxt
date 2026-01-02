import { PrismaClient } from '@prisma/client'
import RSS from 'rss'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Status page slug is required'
    })
  }

  // Get status page with incidents
  const statusPage = await prisma.statusPage.findUnique({
    where: { slug },
    include: {
      incidents: {
        orderBy: { createdAt: 'desc' },
        take: 50
      }
    }
  })

  if (!statusPage || !statusPage.published) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Generate RSS feed
  const baseUrl = getRequestURL(event).origin
  
  const feed = new RSS({
    title: `${statusPage.title} - Status Updates`,
    description: statusPage.description || `Status updates for ${statusPage.title}`,
    feed_url: `${baseUrl}/api/status/${slug}/rss`,
    site_url: `${baseUrl}/status/${slug}`,
    language: 'en',
    pubDate: new Date(),
    ttl: 5
  })

  // Add incidents to feed
  for (const incident of statusPage.incidents) {
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

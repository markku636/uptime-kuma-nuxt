// server/api/v1/status-pages/[slug]/incident.delete.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug is required'
    })
  }

  const statusPage = await prisma.statusPage.findUnique({
    where: { slug },
    include: {
      incidents: {
        where: { pin: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Verify ownership
  if (statusPage.userId !== session.user.id) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to modify this status page'
    })
  }

  // Unpin the latest incident
  if (statusPage.incidents.length > 0) {
    await prisma.incident.update({
      where: { id: statusPage.incidents[0].id },
      data: { pin: false }
    })
  }

  return {
    ok: true,
    message: 'Incident unpinned successfully'
  }
})

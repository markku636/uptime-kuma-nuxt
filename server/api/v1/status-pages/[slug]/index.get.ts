// server/api/v1/status-pages/[slug]/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
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
      groups: {
        include: {
          monitors: {
            include: {
              monitor: {
                include: {
                  heartbeats: {
                    take: 50,
                    orderBy: { time: 'desc' }
                  }
                }
              }
            }
          }
        },
        orderBy: { weight: 'asc' }
      },
      incidents: {
        where: { pin: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  if (!statusPage.published) {
    // Check if user is authenticated
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({
        statusCode: 404,
        message: 'Status page not found'
      })
    }
  }

  return {
    ok: true,
    data: statusPage
  }
})

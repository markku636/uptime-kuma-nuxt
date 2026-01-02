// server/api/v1/status-pages/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const statusPages = await prisma.statusPage.findMany({
    include: {
      groups: {
        include: {
          monitors: {
            include: {
              monitor: true
            }
          }
        },
        orderBy: { weight: 'asc' }
      },
      incidents: {
        where: { pin: true },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    ok: true,
    data: statusPages
  }
})

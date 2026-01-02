// server/api/v1/maintenances/[id].get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '0')
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Invalid maintenance ID'
    })
  }

  const maintenance = await prisma.maintenance.findUnique({
    where: { id }
  })

  if (!maintenance) {
    throw createError({
      statusCode: 404,
      message: 'Maintenance not found'
    })
  }

  return {
    ok: true,
    data: maintenance
  }
})

// server/api/v1/maintenance/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const maintenances = await prisma.maintenance.findMany({
    orderBy: { id: 'desc' }
  })

  return {
    ok: true,
    data: maintenances
  }
})

// server/api/v1/maintenance/[id].delete.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '')
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid maintenance ID'
    })
  }

  await prisma.maintenance.delete({
    where: { id }
  })

  return {
    ok: true,
    message: 'Maintenance deleted successfully'
  }
})

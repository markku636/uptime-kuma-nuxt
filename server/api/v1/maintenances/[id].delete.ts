// server/api/v1/maintenances/[id].delete.ts
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

  // Check if maintenance exists
  const existing = await prisma.maintenance.findUnique({
    where: { id }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Maintenance not found'
    })
  }

  // Delete maintenance
  await prisma.maintenance.delete({
    where: { id }
  })

  return {
    ok: true,
    message: 'Maintenance deleted successfully'
  }
})

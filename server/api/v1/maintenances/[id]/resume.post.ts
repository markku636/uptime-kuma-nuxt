// server/api/v1/maintenances/[id]/resume.post.ts
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

  // Update maintenance to active
  const maintenance = await prisma.maintenance.update({
    where: { id },
    data: { active: true }
  })

  return {
    ok: true,
    data: maintenance
  }
})

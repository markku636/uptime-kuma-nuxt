// server/api/v1/tags/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' }
  })

  return {
    ok: true,
    data: tags
  }
})

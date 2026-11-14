// server/api/v1/tags/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const tags = await prisma.tag.findMany({where: { workspaceId: session.workspaceId },
    orderBy: { name: 'asc' }
  })

  return {
    ok: true,
    data: tags
  }
})

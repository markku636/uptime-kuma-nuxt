// server/api/v1/remote-browsers/index.get.ts
import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const remoteBrowsers = await prisma.remoteBrowser.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' }
  })

  return {
    success: true,
    data: remoteBrowsers
  }
})

// server/api/v1/remote-browsers/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // TODO: Get userId from auth
  const userId = 1

  const id = parseInt(getRouterParam(event, 'id') || '')
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid ID'
    })
  }

  // Check ownership
  const existing = await prisma.remoteBrowser.findFirst({
    where: { id, userId }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Remote browser not found'
    })
  }

  // Check if browser is in use by any monitor
  const monitorsUsingBrowser = await prisma.monitor.count({
    where: { remoteBrowserId: id }
  })

  if (monitorsUsingBrowser > 0) {
    throw createError({
      statusCode: 400,
      message: `Cannot delete: ${monitorsUsingBrowser} monitor(s) are using this remote browser`
    })
  }

  await prisma.remoteBrowser.delete({
    where: { id }
  })

  return {
    success: true,
    message: 'Remote browser deleted'
  }
})

// server/api/v1/remote-browsers/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
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
      message: 'Invalid ID'
    })
  }

  // Check ownership
  const existing = await prisma.remoteBrowser.findFirst({
    where: { id, workspaceId: session.workspaceId }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Remote browser not found'
    })
  }

  // Check if browser is in use by any monitor
  const monitorsUsingBrowser = await prisma.monitor.count({
    where: { remoteBrowserId: id, workspaceId: session.workspaceId, environmentId: session.environmentId }
  })

  if (monitorsUsingBrowser > 0) {
    throw createError({
      statusCode: 400,
      message: `Cannot delete: ${monitorsUsingBrowser} monitor(s) are using this remote browser`
    })
  }

  await prisma.remoteBrowser.delete({
    where: { id, workspaceId: session.workspaceId }
  })

  return {
    success: true,
    message: 'Remote browser deleted'
  }
})

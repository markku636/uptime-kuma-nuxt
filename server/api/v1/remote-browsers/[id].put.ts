// server/api/v1/remote-browsers/[id].put.ts
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { prisma } from '~/server/utils/prisma'

interface UpdateRemoteBrowserBody {
  name?: string
  url?: string
  active?: boolean
}

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
      message: 'Invalid ID'
    })
  }

  const body = await readBody<UpdateRemoteBrowserBody>(event)

  // Validate URL format if provided
  if (body.url) {
    try {
      new URL(body.url)
    } catch {
      throw createError({
        statusCode: 400,
        message: 'Invalid URL format'
      })
    }
  }

  // Check ownership
  const existing = await prisma.remoteBrowser.findFirst({
    where: { id, userId: session.user.id }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Remote browser not found'
    })
  }

  const remoteBrowser = await prisma.remoteBrowser.update({
    where: { id },
    data: {
      name: body.name,
      url: body.url,
      active: body.active
    }
  })

  return {
    success: true,
    data: remoteBrowser
  }
})

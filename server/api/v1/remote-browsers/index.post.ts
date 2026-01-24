// server/api/v1/remote-browsers/index.post.ts
import { defineEventHandler, readBody } from 'h3'
import { prisma } from '~/server/utils/prisma'

interface CreateRemoteBrowserBody {
  name: string
  url: string
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

  const body = await readBody<CreateRemoteBrowserBody>(event)

  // Validate required fields
  if (!body.name || !body.url) {
    throw createError({
      statusCode: 400,
      message: 'Name and URL are required'
    })
  }

  // Validate URL format
  try {
    new URL(body.url)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Invalid URL format'
    })
  }

  const remoteBrowser = await prisma.remoteBrowser.create({
    data: {
      name: body.name,
      url: body.url,
      active: body.active ?? true,
      userId: session.user.id
    }
  })

  return {
    success: true,
    data: remoteBrowser
  }
})

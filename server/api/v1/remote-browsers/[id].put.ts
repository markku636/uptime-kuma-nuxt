// server/api/v1/remote-browsers/[id].put.ts
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface UpdateRemoteBrowserBody {
  name?: string
  url?: string
  active?: boolean
}

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
    where: { id, userId }
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

// server/api/v1/remote-browsers/index.post.ts
import { defineEventHandler, readBody } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CreateRemoteBrowserBody {
  name: string
  url: string
  active?: boolean
}

export default defineEventHandler(async (event) => {
  // TODO: Get userId from auth
  const userId = 1

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
      userId
    }
  })

  return {
    success: true,
    data: remoteBrowser
  }
})

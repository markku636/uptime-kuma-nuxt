import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const updateApiKeySchema = z.object({
  active: z.boolean().optional(),
  name: z.string().min(1).optional()
}).partial()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = parseInt(getRouterParam(event, 'id') || '')
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid API key ID'
    })
  }

  // Verify ownership
  const existing = await prisma.apiKey.findFirst({
    where: {
      id,
      userId: session.user.id
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'API key not found'
    })
  }

  const data = updateApiKeySchema.parse(body)

  const apiKey = await prisma.apiKey.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      active: true,
      expires: true,
      createdAt: true
    }
  })

  return apiKey
})

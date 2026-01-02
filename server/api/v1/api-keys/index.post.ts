// server/api/v1/api-keys/index.post.ts
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readValidatedBody(event, schema.parse)

  // Generate a unique API key
  const keyValue = `uk_${nanoid(32)}`

  const apiKey = await prisma.apiKey.create({
    data: {
      name: body.name,
      key: keyValue,
      userId: session.user.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      active: true
    }
  })

  // Return the key value only once at creation time
  return {
    id: apiKey.id,
    name: apiKey.name,
    key: keyValue,
    createdAt: apiKey.createdAt,
    expiresAt: apiKey.expiresAt
  }
})

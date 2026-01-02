// server/api/v1/tags/index.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const result = createTagSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const tag = await prisma.tag.create({
    data: result.data
  })

  return {
    ok: true,
    data: tag
  }
})

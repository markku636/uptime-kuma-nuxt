// server/api/v1/tags/index.post.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  
  // Basic validation
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Name is required'
    })
  }
  
  if (!body.color || typeof body.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid color format (must be #RRGGBB)'
    })
  }

  const tag = await prisma.tag.create({
    data: {
      name: body.name.trim(),
      color: body.color,
      userId: session.user.id
    }
  })

  return {
    ok: true,
    data: tag
  }
})

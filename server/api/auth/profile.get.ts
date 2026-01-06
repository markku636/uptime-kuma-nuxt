// server/api/auth/profile.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatar: true,
      createdAt: true
    }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  return {
    ok: true,
    username: user.username,
    email: user.email || '',
    displayName: user.displayName || '',
    avatar: user.avatar || '',
    createdAt: user.createdAt
  }
})

// server/api/auth/2fa/disable.post.ts
import { z } from 'zod'
import { verifyPassword } from '../../../utils/password'

const disableSchema = z.object({
  password: z.string().min(1, 'Password is required')
})

export default defineEventHandler(async (event) => {
  // Get current user session
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  
  // Validate input
  const result = disableSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const { password } = result.data

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, twofaStatus: true }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password)
  if (!isValidPassword) {
    throw createError({
      statusCode: 401,
      message: 'Invalid password'
    })
  }

  if (!user.twofaStatus) {
    throw createError({
      statusCode: 400,
      message: '2FA is not enabled'
    })
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twofaStatus: false,
      twofaSecret: null
    }
  })

  return {
    ok: true,
    data: {
      message: '2FA has been disabled'
    }
  }
})

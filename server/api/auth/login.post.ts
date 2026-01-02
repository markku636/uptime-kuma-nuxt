// server/api/auth/login.post.ts
import { z } from 'zod'
import { verifyPassword } from '../../utils/password'
import { verifyTwoFactorToken } from '../../services/auth/two-factor'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  token: z.string().optional(), // 2FA token (optional, required if 2FA enabled)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Validate input
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const { username, password, token } = result.data

  // Find user
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      password: true,
      active: true,
      timezone: true,
      twofaStatus: true,
      twofaSecret: true
    }
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials'
    })
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password)
  if (!isValidPassword) {
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials'
    })
  }

  // Check if user is active
  if (!user.active) {
    throw createError({
      statusCode: 401,
      message: 'Account is disabled'
    })
  }

  // Check 2FA if enabled
  if (user.twofaStatus && user.twofaSecret) {
    if (!token) {
      // Return special response indicating 2FA is required
      return {
        ok: false,
        tokenRequired: true,
        message: '2FA token required'
      }
    }

    // Verify 2FA token
    const verification = verifyTwoFactorToken(token, user.twofaSecret)
    if (!verification.valid) {
      throw createError({
        statusCode: 401,
        message: 'Invalid 2FA token'
      })
    }
  }

  // Set session
  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      timezone: user.timezone,
    }
  })

  return {
    ok: true,
    data: {
      id: user.id,
      username: user.username,
      timezone: user.timezone,
    }
  }
})

// server/api/auth/login.post.ts
import { z } from 'zod'
import { verifyPassword } from '../../utils/password'
import { createTrackedSession } from '../../utils/tracked-sessions'
import { verifyTwoFactorToken, verifyBackupCode } from '../../services/auth/two-factor'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
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
      twofaSecret: true,
      twofaBackupCodes: true,
      sessionVersion: true
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

    // Verify 2FA token: 6-digit TOTP or a one-time backup code
    let verified = verifyTwoFactorToken(token, user.twofaSecret).valid
    if (!verified && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(token.toUpperCase())) {
      const codes = Array.isArray(user.twofaBackupCodes) ? user.twofaBackupCodes as string[] : []
      const backup = verifyBackupCode(token.toUpperCase(), codes)
      if (backup.valid) {
        verified = true
        const remaining = codes.filter((_, index) => index !== backup.usedIndex)
        await prisma.user.update({ where: { id: user.id }, data: { twofaBackupCodes: remaining } })
      }
    }
    if (!verified) {
      throw createError({ statusCode: 401, message: 'Invalid 2FA token' })
    }
  }

  // Set session with a revocable server-side record
  const sessionId = await createTrackedSession(event, user.id)
  await setUserSession(event, {
    sessionId,
    user: {
      id: user.id,
      username: user.username,
      timezone: user.timezone,
      sessionVersion: user.sessionVersion,
    }
  })

  return {
    ok: true,
    data: {
      id: user.id,
      username: user.username,
      timezone: user.timezone,
      sessionVersion: user.sessionVersion,
    }
  }
})

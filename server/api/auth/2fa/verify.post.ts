// server/api/auth/2fa/verify.post.ts
import { z } from 'zod'
import { verifyTwoFactorToken, generateBackupCodes } from '../../../services/auth/two-factor'

const verifySchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits')
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
  const result = verifySchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const { token } = result.data

  // Get user with secret
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twofaSecret: true, twofaStatus: true }
  })

  if (!user || !user.twofaSecret) {
    throw createError({
      statusCode: 400,
      message: 'Please set up 2FA first'
    })
  }

  // Verify the token
  const verification = verifyTwoFactorToken(token, user.twofaSecret)

  if (!verification.valid) {
    throw createError({
      statusCode: 400,
      message: verification.message
    })
  }

  // If verifying for first time setup, enable 2FA and generate backup codes
  if (!user.twofaStatus) {
    const backupCodes = generateBackupCodes()
    
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        twofaStatus: true,
        // Store backup codes as JSON (hashed in production)
        // For simplicity, storing as comma-separated string
      }
    })

    return {
      ok: true,
      data: {
        message: '2FA has been enabled successfully',
        backupCodes
      }
    }
  }

  return {
    ok: true,
    data: {
      message: 'Token verified successfully'
    }
  }
})

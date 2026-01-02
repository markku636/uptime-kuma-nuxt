// server/api/auth/2fa/setup.post.ts
import { z } from 'zod'
import { generateTwoFactorSetup } from '../../../services/auth/two-factor'

export default defineEventHandler(async (event) => {
  // Get current user session
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  // Check if 2FA is already enabled
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twofaStatus: true, username: true }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  if (user.twofaStatus) {
    throw createError({
      statusCode: 400,
      message: '2FA is already enabled'
    })
  }

  // Generate 2FA setup
  const setup = await generateTwoFactorSetup(user.username)

  // Store the secret temporarily (will be confirmed in verify step)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twofaSecret: setup.secret }
  })

  return {
    ok: true,
    data: {
      qrCode: setup.qrCode,
      uri: setup.uri,
      // Don't expose the secret directly, only for manual entry if needed
      manualEntryKey: setup.secret
    }
  }
})

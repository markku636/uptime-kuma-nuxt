// server/api/auth/2fa/status.get.ts

export default defineEventHandler(async (event) => {
  // Get current user session
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  // Get user's 2FA status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twofaStatus: true }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  return {
    ok: true,
    data: {
      enabled: user.twofaStatus
    }
  }
})

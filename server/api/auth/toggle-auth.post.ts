// server/api/auth/toggle-auth.post.ts
import { prisma } from '~/server/utils/prisma'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const { disableAuth, password } = body

  // If trying to disable auth, require password verification
  if (disableAuth) {
    if (!password) {
      throw createError({
        statusCode: 400,
        message: 'Password is required to disable authentication'
      })
    }

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true }
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw createError({
        statusCode: 401,
        message: 'Invalid password'
      })
    }
  }

  // Update the disable_auth setting
  await prisma.setting.upsert({
    where: { key: 'disableAuth' },
    update: { value: String(disableAuth), type: 'boolean' },
    create: { key: 'disableAuth', value: String(disableAuth), type: 'boolean' }
  })

  return {
    ok: true,
    message: disableAuth ? 'Authentication disabled' : 'Authentication enabled',
    disableAuth
  }
})

// server/api/auth/setup.post.ts
import { z } from 'zod'
import { hashPassword } from '../../utils/password'

const setupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters').max(200),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Validate input
  const result = setupSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0].message
    })
  }

  const { username, password } = result.data

  // Hash password and create user
  const hashedPassword = await hashPassword(password)
  
  const user = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(736291042)`
    if (await tx.user.findFirst()) throw createError({ statusCode: 400, message: 'Setup has already been completed' })
    return tx.user.create({ data: { username, password: hashedPassword, active: true, platformAdmin: true } })
  })
  await ensurePersonalWorkspace(user.id, user.username)

  // Set session
  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      timezone: user.timezone,
      sessionVersion: user.sessionVersion,
    }
  })

  return {
    ok: true,
    message: 'Setup completed successfully',
    data: {
      id: user.id,
      username: user.username,
    }
  }
})

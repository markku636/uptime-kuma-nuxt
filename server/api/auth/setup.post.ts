// server/api/auth/setup.post.ts
import { z } from 'zod'
import { hashPassword } from '../../utils/password'

const setupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default defineEventHandler(async (event) => {
  // Check if any user exists (setup already done)
  const existingUser = await prisma.user.findFirst()
  if (existingUser) {
    throw createError({
      statusCode: 400,
      message: 'Setup has already been completed'
    })
  }

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
  
  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      active: true,
    }
  })

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
    message: 'Setup completed successfully',
    data: {
      id: user.id,
      username: user.username,
    }
  }
})

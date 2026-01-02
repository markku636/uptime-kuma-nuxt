// server/api/auth/change-password.post.ts
import { z } from 'zod'
import { verifyPassword, hashPassword } from '../../utils/password'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readValidatedBody(event, schema.parse)

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  // Verify current password
  const isValid = await verifyPassword(body.currentPassword, user.password)
  if (!isValid) {
    throw createError({
      statusCode: 400,
      message: 'Current password is incorrect'
    })
  }

  // Hash new password
  const hashedPassword = await hashPassword(body.newPassword)

  // Update password
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword }
  })

  return { success: true }
})

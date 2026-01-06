// server/api/auth/profile.put.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  // Handle both FormData and JSON body
  const contentType = getHeader(event, 'content-type') || ''
  let displayName = ''
  let email = ''
  let removeAvatar = false
  let avatarData: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await readMultipartFormData(event)
    
    if (formData) {
      for (const field of formData) {
        if (field.name === 'displayName') {
          displayName = field.data.toString()
        } else if (field.name === 'email') {
          email = field.data.toString()
        } else if (field.name === 'removeAvatar') {
          removeAvatar = field.data.toString() === 'true'
        } else if (field.name === 'avatar' && field.filename) {
          // Convert to base64 data URL for simple storage
          const base64 = field.data.toString('base64')
          avatarData = `data:${field.type};base64,${base64}`
        }
      }
    }
  } else {
    const body = await readBody(event)
    displayName = body.displayName || ''
    email = body.email || ''
    removeAvatar = body.removeAvatar || false
  }

  // Build update data
  const updateData: any = {
    displayName: displayName || null,
    email: email || null
  }

  if (removeAvatar) {
    updateData.avatar = null
  } else if (avatarData) {
    updateData.avatar = avatarData
  }

  // Update user
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatar: true
    }
  })

  return {
    ok: true,
    message: 'Profile updated successfully',
    user
  }
})

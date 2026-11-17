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
          // Stored as a data URL: images only, and small
          if (!/^image\/(png|jpeg|gif|webp)$/.test(field.type || '')) {
            throw createError({ statusCode: 400, message: 'Avatar must be a PNG, JPEG, GIF or WebP image' })
          }
          if (field.data.length > 512 * 1024) {
            throw createError({ statusCode: 400, message: 'Avatar must be smaller than 512 KB' })
          }
          avatarData = `data:${field.type};base64,${field.data.toString('base64')}`
        }
      }
    }
  } else {
    const body = await readBody(event)
    displayName = body.displayName || ''
    email = body.email || ''
    removeAvatar = body.removeAvatar || false
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, message: 'Invalid email address' })
  }

  // Build update data
  const updateData: any = {
    displayName: displayName.slice(0, 100) || null,
    email: email.slice(0, 254) || null
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

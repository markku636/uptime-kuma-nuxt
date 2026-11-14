// server/api/v1/status-pages/[slug]/upload-logo.post.ts
import { prisma } from '~/server/utils/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
  
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug is required'
    })
  }

  const statusPage = await prisma.statusPage.findFirst({
    where: { slug, workspaceId: session.workspaceId }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Verify ownership

  const body = await readBody(event)
  const { logo } = body

  if (!logo) {
    throw createError({
      statusCode: 400,
      message: 'Logo data is required'
    })
  }

  // Parse data URL
  const matches = logo.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/)
  
  if (!matches) {
    throw createError({
      statusCode: 400,
      message: 'Invalid image format. Please provide a valid base64 image.'
    })
  }

  const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1]
  const base64Data = matches[2]
  const buffer = Buffer.from(base64Data, 'base64')

  // Limit file size to 2MB
  if (buffer.length > 2 * 1024 * 1024) {
    throw createError({
      statusCode: 400,
      message: 'Image size must be less than 2MB'
    })
  }

  // Create upload directory if not exists
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'status-pages')
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true })
  }

  // Generate unique filename
  const timestamp = Date.now()
  const filename = `${slug}-logo-${timestamp}.${extension}`
  const filePath = join(uploadDir, filename)

  // Write file
  await writeFile(filePath, buffer)

  // Update status page icon
  const logoUrl = `/uploads/status-pages/${filename}`
  
  await prisma.statusPage.update({
    where: { slug, workspaceId: session.workspaceId },
    data: { icon: logoUrl }
  })

  return {
    ok: true,
    data: {
      logoUrl
    }
  }
})

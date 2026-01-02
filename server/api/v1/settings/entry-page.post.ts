// API endpoint to update entry page configuration
import { defineEventHandler, readBody, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface EntryPageRequest {
  entryPage: 'dashboard' | 'status'
  statusSlug?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<EntryPageRequest>(event)

  if (!body.entryPage) {
    throw createError({
      statusCode: 400,
      message: 'Entry page type is required'
    })
  }

  if (!['dashboard', 'status'].includes(body.entryPage)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid entry page type'
    })
  }

  if (body.entryPage === 'status' && !body.statusSlug) {
    throw createError({
      statusCode: 400,
      message: 'Status page slug is required when entry page is set to status'
    })
  }

  try {
    // Update entry page setting
    await prisma.setting.upsert({
      where: { key: 'entryPage' },
      update: { value: body.entryPage },
      create: { key: 'entryPage', value: body.entryPage }
    })

    // Update status slug if provided
    if (body.statusSlug) {
      // Verify status page exists
      const statusPage = await prisma.statusPage.findFirst({
        where: { slug: body.statusSlug }
      })

      if (!statusPage) {
        throw createError({
          statusCode: 404,
          message: 'Status page not found'
        })
      }

      await prisma.setting.upsert({
        where: { key: 'entryPageStatusSlug' },
        update: { value: body.statusSlug },
        create: { key: 'entryPageStatusSlug', value: body.statusSlug }
      })
    }

    return {
      success: true,
      entryPage: body.entryPage,
      statusSlug: body.statusSlug
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to update entry page configuration'
    })
  }
})

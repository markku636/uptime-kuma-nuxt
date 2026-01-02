// API endpoint to manage entry page configuration
import { defineEventHandler, readBody, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Get entry page configuration
export default defineEventHandler(async (event) => {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['entryPage', 'entryPageStatusSlug']
        }
      }
    })

    const entryPage = settings.find(s => s.key === 'entryPage')?.value || 'dashboard'
    const statusSlug = settings.find(s => s.key === 'entryPageStatusSlug')?.value || ''

    // Get available status pages for selection
    const statusPages = await prisma.statusPage.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        published: true
      },
      where: {
        published: true
      }
    })

    return {
      entryPage,
      statusSlug,
      options: [
        { value: 'dashboard', label: 'Dashboard' },
        { value: 'status', label: 'Status Page' }
      ],
      statusPages: statusPages.map(sp => ({
        value: sp.slug,
        label: sp.title
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch entry page configuration'
    })
  }
})

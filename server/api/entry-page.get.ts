import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Get entry page configuration
export default defineEventHandler(async (event) => {
  // Check if there are any users (setup completed)
  const userCount = await prisma.user.count()
  
  if (userCount === 0) {
    // No users - redirect to setup
    return {
      entryPage: 'setup',
      setupRequired: true
    }
  }

  // Get entry page setting
  const setting = await prisma.setting.findUnique({
    where: { key: 'entryPage' }
  })

  // Get default status page if entry page is set to status page
  const statusPageSetting = await prisma.setting.findUnique({
    where: { key: 'defaultStatusPage' }
  })

  // Get first published status page as fallback
  const defaultStatusPage = await prisma.statusPage.findFirst({
    where: { published: true },
    select: { slug: true }
  })

  return {
    entryPage: setting?.value || 'dashboard',
    statusPageSlug: statusPageSetting?.value || defaultStatusPage?.slug || null,
    setupRequired: false
  }
})

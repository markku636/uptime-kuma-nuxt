// server/api/v1/remote-browsers/index.get.ts
import { defineEventHandler } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // TODO: Get userId from auth
  const userId = 1

  const remoteBrowsers = await prisma.remoteBrowser.findMany({
    where: { userId },
    orderBy: { name: 'asc' }
  })

  return {
    success: true,
    data: remoteBrowsers
  }
})

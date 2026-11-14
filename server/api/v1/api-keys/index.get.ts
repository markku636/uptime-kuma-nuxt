// server/api/v1/api-keys/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireWorkspace(event, 'owner')

  const apiKeys = await prisma.apiKey.findMany({
    where: { workspaceId: session.workspaceId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      expires: true,
      active: true,
      scope: true, environmentId: true
      // Don't return the actual key value
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return apiKeys
})

// server/api/v1/status-pages/[slug]/incident.delete.ts
import { prisma } from '~/server/utils/prisma'
import { requireStatusPageEditor } from '~/server/utils/status-page-editor'

export default defineEventHandler(async (event) => {
  const scope = await requireStatusPageEditor(event)

  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug is required'
    })
  }

  const statusPage = await prisma.statusPage.findFirst({
    where: { slug, workspaceId: scope.workspaceId },
    include: {
      incidents: {
        where: { pin: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!statusPage) {
    throw createError({
      statusCode: 404,
      message: 'Status page not found'
    })
  }

  // Verify ownership

  // Unpin the latest incident
  if (statusPage.incidents.length > 0) {
    await prisma.incident.update({
      where: { id: statusPage.incidents[0].id },
      data: { pin: false }
    })
  }

  return {
    ok: true,
    message: 'Incident unpinned successfully'
  }
})

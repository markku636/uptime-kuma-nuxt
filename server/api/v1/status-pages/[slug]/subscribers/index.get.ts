import { prisma } from '~/server/utils/prisma'
import { requireStatusPageEditor } from '~/server/utils/status-page-editor'

export default defineEventHandler(async event => {
  const scope = await requireStatusPageEditor(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug is required' })
  const page = await prisma.statusPage.findFirst({ where: { slug, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const rows = await prisma.statusPageSubscriber.findMany({
    where: { statusPageId: page.id }, orderBy: { createdAt: 'desc' }, take: 200,
    select: { id: true, email: true, kind: true, url: true, verifiedAt: true, createdAt: true },
  })
  return { ok: true, data: rows.map(row => ({
    id: row.id, email: row.email, kind: row.kind, verified: !!row.verifiedAt,
    urlConfigured: !!row.url, createdAt: row.createdAt,
  })) }
})

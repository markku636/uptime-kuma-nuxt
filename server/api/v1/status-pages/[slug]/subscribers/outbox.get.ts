import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requireStatusPageEditor } from '~/server/utils/status-page-editor'

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).strict()

export default defineEventHandler(async event => {
  const scope = await requireStatusPageEditor(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug is required' })
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid query' })
  const page = await prisma.statusPage.findFirst({ where: { slug, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const rows = await prisma.statusPageNotificationOutbox.findMany({
    where: { statusPageId: page.id }, orderBy: { id: 'desc' }, take: parsed.data.limit,
    select: { id: true, eventType: true, status: true, attempts: true, nextAttemptAt: true, createdAt: true, completedAt: true, subscriberId: true },
  })
  return { ok: true, data: rows.map(row => ({ ...row, id: String(row.id) })) }
})

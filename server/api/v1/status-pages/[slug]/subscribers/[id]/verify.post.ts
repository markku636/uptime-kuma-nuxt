import { prisma } from '~/server/utils/prisma'
import { requireStatusPageEditor } from '~/server/utils/status-page-editor'

/** Operator fallback for confirming a subscriber when SMTP relay is unavailable. */
export default defineEventHandler(async event => {
  const scope = await requireStatusPageEditor(event)
  const slug = getRouterParam(event, 'slug')
  const id = Number(getRouterParam(event, 'id'))
  if (!slug || !Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid subscriber' })
  const page = await prisma.statusPage.findFirst({ where: { slug, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const row = await prisma.statusPageSubscriber.findFirst({ where: { id, statusPageId: page.id }, select: { id: true } })
  if (!row) throw createError({ statusCode: 404, message: 'Subscriber not found' })
  await prisma.statusPageSubscriber.update({ where: { id }, data: { verifiedAt: new Date() } })
  return { ok: true, data: { verified: true } }
})

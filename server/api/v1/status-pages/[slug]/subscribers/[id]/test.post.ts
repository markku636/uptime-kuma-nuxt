import { prisma } from '~/server/utils/prisma'
import { requireStatusPageEditor } from '~/server/utils/status-page-editor'
import { enqueueSubscriberNotifications } from '~/server/services/status-page/subscriber-outbox'

/** Queue a synthetic event to verify a subscriber's endpoint without touching incidents. */
export default defineEventHandler(async event => {
  const scope = await requireStatusPageEditor(event)
  const slug = getRouterParam(event, 'slug')
  const id = Number(getRouterParam(event, 'id'))
  if (!slug || !Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid subscriber' })
  const page = await prisma.statusPage.findFirst({ where: { slug, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const subscriber = await prisma.statusPageSubscriber.findFirst({ where: { id, statusPageId: page.id }, select: { id: true } })
  if (!subscriber) throw createError({ statusCode: 404, message: 'Subscriber not found' })
  const count = await prisma.statusPageNotificationOutbox.count({ where: { subscriberId: id, eventType: 'subscriber-test', status: 'pending' } })
  if (count > 0) throw createError({ statusCode: 409, message: 'A test is already queued for this subscriber' })
  await prisma.statusPageNotificationOutbox.create({
    data: {
      statusPageId: page.id, subscriberId: id, eventType: 'subscriber-test',
      payload: { event: 'incident-updated', title: 'Test notification', message: 'This is a test from SealWatch.', pageSlug: slug } as any,
      status: 'pending', nextAttemptAt: new Date(),
    },
  })
  return { ok: true, data: { queued: true } }
})

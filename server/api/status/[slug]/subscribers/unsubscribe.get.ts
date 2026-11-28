import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') || ''
  const token = getQuery(event).token
  if (!/^[a-z0-9-]{1,100}$/.test(slug) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw createError({ statusCode: 400, message: 'Invalid unsubscribe link' })
  }
  const page = await prisma.statusPage.findFirst({ where: { slug, published: true }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const subscriber = await prisma.statusPageSubscriber.findUnique({ where: { token }, select: { id: true, statusPageId: true } })
  if (!subscriber || subscriber.statusPageId !== page.id) throw createError({ statusCode: 404, message: 'Subscription not found' })
  await prisma.$transaction([
    prisma.statusPageNotificationOutbox.deleteMany({ where: { subscriberId: subscriber.id, status: 'pending' } }),
    prisma.statusPageSubscriber.delete({ where: { id: subscriber.id } }),
  ])
  await sendRedirect(event, `/status/${encodeURIComponent(slug)}?unsubscribed=1`, 302)
})

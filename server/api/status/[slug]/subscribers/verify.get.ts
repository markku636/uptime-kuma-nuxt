import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') || ''
  const token = getQuery(event).token
  if (!/^[a-z0-9-]{1,100}$/.test(slug) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw createError({ statusCode: 400, message: 'Invalid confirmation link' })
  }
  const page = await prisma.statusPage.findFirst({ where: { slug, published: true }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const subscriber = await prisma.statusPageSubscriber.findUnique({ where: { token }, select: { id: true, statusPageId: true } })
  if (!subscriber || subscriber.statusPageId !== page.id) throw createError({ statusCode: 404, message: 'Confirmation link expired' })
  await prisma.statusPageSubscriber.update({ where: { id: subscriber.id }, data: { verifiedAt: new Date() } })
  await sendRedirect(event, `/status/${encodeURIComponent(slug)}?subscribed=1`, 302)
})

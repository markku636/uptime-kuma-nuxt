import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict()

export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw createError({ statusCode: 400, message: 'Invalid status page' })
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid unsubscribe token' })
  const page = await prisma.statusPage.findFirst({ where: { slug, published: true }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const subscriber = await prisma.statusPageSubscriber.findUnique({ where: { token: parsed.data.token }, select: { id: true, statusPageId: true } })
  if (!subscriber || subscriber.statusPageId !== page.id) throw createError({ statusCode: 404, message: 'Subscription not found' })
  await prisma.$transaction([
    prisma.statusPageNotificationOutbox.deleteMany({ where: { subscriberId: subscriber.id, status: 'pending' } }),
    prisma.statusPageSubscriber.delete({ where: { id: subscriber.id } }),
  ])
  return { ok: true, data: { unsubscribed: true } }
})

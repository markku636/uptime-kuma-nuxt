import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { requireStatusPageEditor } from '~/server/utils/status-page-editor'
import { assertPublicWebhook, sealSubscriberUrl } from '~/server/services/status-page/subscriber-webhook'

const bodySchema = z.object({ url: z.string().max(2048) }).strict()

export default defineEventHandler(async event => {
  const scope = await requireStatusPageEditor(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug is required' })
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid webhook URL' })
  const url = await assertPublicWebhook(parsed.data.url).catch(() => null)
  if (!url) throw createError({ statusCode: 400, message: 'Webhook URL must be a public http(s) endpoint' })

  const page = await prisma.statusPage.findFirst({ where: { slug, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })
  const count = await prisma.statusPageSubscriber.count({ where: { statusPageId: page.id } })
  if (count >= 200) throw createError({ statusCode: 409, message: 'Subscriber limit reached' })

  const row = await prisma.statusPageSubscriber.create({ data: {
    statusPageId: page.id, email: 'webhook', kind: 'webhook',
    url: sealSubscriberUrl(url.href, scope.workspaceId, page.id),
    token: randomBytes(32).toString('hex'), verifiedAt: new Date(),
  } })
  return { ok: true, data: { id: row.id, kind: 'webhook', verified: true } }
})

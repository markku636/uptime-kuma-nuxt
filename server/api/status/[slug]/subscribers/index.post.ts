import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { validSubscriberEmail, smtpConfigured, sendSubscriberMail, confirmationText } from '../../../../services/status-page/subscriber-mail'

const bodySchema = z.object({ email: z.string().max(320) }).strict()
const windows = new Map<string, { time: number; count: number }>()
const WINDOW_MS = 60_000
const PER_IP = 5

export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw createError({ statusCode: 400, message: 'Invalid status page' })
  const page = await prisma.statusPage.findFirst({ where: { slug, published: true }, select: { id: true, slug: true } })
  if (!page) throw createError({ statusCode: 404, message: 'Status page not found' })

  const ip = getRequestIP(event) || 'unknown'
  const now = Date.now(), window = windows.get(ip)
  const current = window && now - window.time < WINDOW_MS ? window : { time: now, count: 0 }
  if (current.count >= PER_IP) throw createError({ statusCode: 429, message: 'Too many subscription attempts; retry shortly' })
  current.count++
  windows.set(ip, current)

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid email' })
  const email = validSubscriberEmail(parsed.data.email)
  if (!email) throw createError({ statusCode: 400, message: 'Invalid email' })

  const token = randomBytes(32).toString('hex')
  const existing = await prisma.statusPageSubscriber.findUnique({ where: { statusPageId_email: { statusPageId: page.id, email } }, select: { id: true, verifiedAt: true } })
  if (existing?.verifiedAt) return { ok: true, data: { alreadySubscribed: true } }

  if (existing) {
    await prisma.statusPageSubscriber.update({ where: { id: existing.id }, data: { token } })
  } else {
    await prisma.statusPageSubscriber.create({ data: { statusPageId: page.id, email, token } })
  }

  let mail: 'sent' | 'unavailable' = 'sent'
  if (smtpConfigured()) {
    const message = confirmationText(page.slug, token)
    try { await sendSubscriberMail(email, message.subject, message.text) } catch { mail = 'unavailable' }
  } else mail = 'unavailable'
  return { ok: true, data: { pending: true, mail } }
})

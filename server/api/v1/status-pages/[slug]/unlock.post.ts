import { verifyPassword } from '../../../../utils/password'
import { issueStatusUnlock } from '../../../../utils/status-password'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug is required' })
  const page = await prisma.statusPage.findUnique({ where: { slug } })
  if (!page?.published || !page.passwordHash) {
    throw createError({ statusCode: 404, message: 'Status page not found' })
  }
  const body = await readBody(event).catch(() => ({})) as { password?: unknown }
  if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 200) {
    throw createError({ statusCode: 400, message: 'Password is required' })
  }
  if (!await verifyPassword(body.password, page.passwordHash)) {
    throw createError({ statusCode: 401, message: 'Incorrect password' })
  }
  issueStatusUnlock(event, page.id, page.passwordHash)
  return { ok: true }
})

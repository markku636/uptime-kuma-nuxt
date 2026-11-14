import { z } from 'zod'
import { hashPassword } from '../../../utils/password'
export default defineEventHandler(async event => {
  await requirePlatformAdmin(event)
  const body = await readValidatedBody(event, z.object({ username: z.string().trim().min(3).max(100), password: z.string().min(12).max(200) }).parse)
  const user = await prisma.user.create({ data: { username: body.username, password: await hashPassword(body.password) }, select: { id: true, username: true } })
  await ensurePersonalWorkspace(user.id, user.username)
  return { ok: true, data: user }
})

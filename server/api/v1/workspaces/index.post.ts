import { z } from 'zod'
export default defineEventHandler(async event => {
  const { user } = await requireRequestSession(event)
  if (event.context.authMethod !== 'session') throw createError({ statusCode: 403, message: 'Session required' })
  const body = await readValidatedBody(event, z.object({ name: z.string().trim().min(1).max(100) }).parse)
  const workspace = await prisma.workspace.create({ data: { name: body.name, members: { create: { userId: user.id, role: 'owner' } },
    environments: { create: { name: 'default' } } }, include: { environments: { select: { id: true, name: true } } } })
  return { ok: true, data: { ...workspace, role: 'owner' } }
})

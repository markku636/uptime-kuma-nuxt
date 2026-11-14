import { z } from 'zod'
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const body = await readValidatedBody(event, z.object({ username: z.string().min(1), role: z.enum(['owner','editor','viewer']) }).parse)
  const user = await prisma.user.findUnique({ where: { username: body.username }, select: { id: true } })
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })
  const member = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${scope.workspaceId} FOR UPDATE`
    const actor = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId: scope.user.id } } })
    if (actor?.role !== 'owner') throw createError({ statusCode: 403, message: 'Workspace owner required' })
    const existing = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId: user.id } } })
    if (existing?.role === 'owner' && body.role !== 'owner' && await tx.workspaceMember.count({ where: { workspaceId: scope.workspaceId, role: 'owner' } }) === 1) {
      throw createError({ statusCode: 409, message: 'Workspace must keep an owner' })
    }
    return tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId: user.id } },
      create: { workspaceId: scope.workspaceId, userId: user.id, role: body.role }, update: { role: body.role } })
  })
  return { ok: true, data: member }
})

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner'), userId = Number(getRouterParam(event, 'userId'))
  if (!Number.isSafeInteger(userId)) throw createError({ statusCode: 400, message: 'Invalid user ID' })
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${scope.workspaceId} FOR UPDATE`
    const actor = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId: scope.user.id } } })
    if (actor?.role !== 'owner') throw createError({ statusCode: 403, message: 'Workspace owner required' })
    const member = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId } } })
    if (!member) throw createError({ statusCode: 404, message: 'Member not found' })
    if (member.role === 'owner' && await tx.workspaceMember.count({ where: { workspaceId: scope.workspaceId, role: 'owner' } }) === 1) {
      throw createError({ statusCode: 409, message: 'Workspace must keep an owner' })
    }
    await tx.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId } } })
    await tx.apiKey.updateMany({ where: { workspaceId: scope.workspaceId, userId }, data: { active: false } })
  })
  return { ok: true }
})

export default defineEventHandler(async event => {
  const { user } = await requireRequestSession(event)
  if (event.context.authMethod !== 'session') throw createError({ statusCode: 403, message: 'Session required' })
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id },
    include: { workspace: { include: { environments: { select: { id: true, name: true } } } } }, orderBy: { workspaceId: 'asc' } })
  return { ok: true, data: memberships.map(({ role, workspace }) => ({ ...workspace, role })) }
})

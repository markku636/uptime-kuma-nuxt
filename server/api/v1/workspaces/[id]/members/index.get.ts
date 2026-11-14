export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId: scope.workspaceId },
    include: { user: { select: { id: true, username: true, active: true } } } })
  return { ok: true, data: members }
})

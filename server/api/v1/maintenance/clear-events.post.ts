export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const result = await prisma.incident.deleteMany({ where: { statusPage: { workspaceId: scope.workspaceId } } })
  return { success: true, deleted: result.count }
})

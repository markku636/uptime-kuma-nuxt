export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const result = await prisma.heartbeat.deleteMany({ where: { monitor: { workspaceId: scope.workspaceId } } })
  return { success: true, deleted: result.count }
})

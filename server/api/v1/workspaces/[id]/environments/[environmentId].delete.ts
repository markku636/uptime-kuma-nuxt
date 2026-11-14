export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner'), id = Number(getRouterParam(event, 'environmentId'))
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${scope.workspaceId} FOR UPDATE`
    if (await tx.environment.count({ where: { workspaceId: scope.workspaceId } }) < 2) throw createError({ statusCode: 409, message: 'Keep at least one environment' })
    if (await tx.monitor.count({ where: { workspaceId: scope.workspaceId, environmentId: id } })) throw createError({ statusCode: 409, message: 'Environment has monitors' })
    const result = await tx.environment.deleteMany({ where: { id, workspaceId: scope.workspaceId } })
    if (!result.count) throw createError({ statusCode: 404, message: 'Environment not found' })
  })
  return { ok: true }
})

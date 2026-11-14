export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const where = { workspaceId: scope.workspaceId }
  await prisma.$transaction(async tx => {
    await tx.monitor.deleteMany({ where }); await tx.statusPage.deleteMany({ where })
    await tx.maintenance.deleteMany({ where }); await tx.notification.deleteMany({ where })
    await tx.tag.deleteMany({ where }); await tx.proxy.deleteMany({ where })
    await tx.dockerHost.deleteMany({ where }); await tx.remoteBrowser.deleteMany({ where })
  })
  return { success: true, message: 'Workspace resources cleared' }
})

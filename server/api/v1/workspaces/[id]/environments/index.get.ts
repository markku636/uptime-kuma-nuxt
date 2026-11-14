import { environmentDTO } from '../../../../../utils/variables'
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event)
  return { ok: true, data: (await prisma.environment.findMany({ where: { workspaceId: scope.workspaceId }, orderBy: { id: 'asc' } })).map(environmentDTO) }
})

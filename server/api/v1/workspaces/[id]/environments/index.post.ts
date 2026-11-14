import { z } from 'zod'
import { environmentDTO } from '../../../../../utils/variables'
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const body = await readValidatedBody(event, z.object({ name: z.string().trim().min(1).max(100) }).parse)
  const environment = await prisma.environment.create({ data: { name: body.name, workspaceId: scope.workspaceId } })
  return { ok: true, data: environmentDTO(environment) }
})

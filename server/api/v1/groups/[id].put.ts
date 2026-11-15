import {z} from 'zod'
import {assertValidParent,cleanGroupName,findGroup} from '../../../services/groups'
const schema = z.object({name: z.string().optional(), parentId: z.number().int().positive().nullable().optional(), sortOrder: z.number().int().min(-100000).max(100000).optional()}).strict()
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor'), parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({statusCode: 400, message: 'Invalid group'})
  const id = Number(getRouterParam(event, 'id'))
  const group = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT id FROM workspaces WHERE id=${scope.workspaceId} FOR UPDATE`
    await findGroup(tx, scope.workspaceId, id)
    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) data.name = cleanGroupName(parsed.data.name)
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder
    if (parsed.data.parentId !== undefined) {
      await assertValidParent(tx, scope.workspaceId, id, parsed.data.parentId)
      data.parentId = parsed.data.parentId
    }
    return tx.monitorGroup.update({where: {id}, data})
  })
  return {ok: true, data: group}
})

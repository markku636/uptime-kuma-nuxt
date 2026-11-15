import {z} from 'zod'
import {assertGroupCapacity,assertValidParent,cleanGroupName} from '../../../services/groups'
const schema = z.object({name: z.string(), parentId: z.number().int().positive().nullable().optional()}).strict()
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor'), parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({statusCode: 400, message: 'Invalid group'})
  const name = cleanGroupName(parsed.data.name), parentId = parsed.data.parentId ?? null
  const group = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT id FROM workspaces WHERE id=${scope.workspaceId} FOR UPDATE`
    await assertGroupCapacity(tx, scope.workspaceId, 1)
    await assertValidParent(tx, scope.workspaceId, null, parentId)
    return tx.monitorGroup.create({data: {workspaceId: scope.workspaceId, parentId, name}})
  })
  return {ok: true, data: group}
})

import {z} from 'zod'
import {moveMonitors} from '../../../services/groups'
const schema = z.object({monitorIds: z.array(z.number().int().positive()).min(1).max(1000), groupId: z.number().int().positive().nullable()}).strict()
/** Moves monitors of the selected environment into a group, or out of every group with groupId null. */
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor'), parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({statusCode: 400, message: 'Select 1–1000 monitors and a target group'})
  const moved = await moveMonitors(scope.workspaceId, scope.environmentId, [...new Set(parsed.data.monitorIds)], parsed.data.groupId)
  return {ok: true, data: {moved}}
})

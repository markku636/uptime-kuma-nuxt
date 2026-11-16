// DELETE /api/v1/groups/:id  (members are kept and move up one level)
import { handleWorkspaceRequest, getIdParam, deleteGroup } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async (userId) => {
    await deleteGroup(userId, getIdParam(event))
    return { ok: true }
  }),
)

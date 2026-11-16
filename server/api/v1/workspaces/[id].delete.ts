// DELETE /api/v1/workspaces/:id  (monitors inside are kept and become unassigned)
import { handleWorkspaceRequest, getIdParam, deleteWorkspace } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async (userId) => {
    await deleteWorkspace(userId, getIdParam(event))
    return { ok: true }
  }),
)

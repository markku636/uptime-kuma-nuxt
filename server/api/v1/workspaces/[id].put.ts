// PUT /api/v1/workspaces/:id
import { handleWorkspaceRequest, getIdParam, updateWorkspace } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({
    ok: true,
    data: await updateWorkspace(userId, getIdParam(event), await readBody(event)),
  })),
)

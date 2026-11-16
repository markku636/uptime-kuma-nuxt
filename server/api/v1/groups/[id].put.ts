// PUT /api/v1/groups/:id
import { handleWorkspaceRequest, getIdParam, updateGroup } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({
    ok: true,
    data: await updateGroup(userId, getIdParam(event), await readBody(event)),
  })),
)

// GET /api/v1/workspaces
import { handleWorkspaceRequest, listWorkspaces } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await listWorkspaces(userId) })),
)

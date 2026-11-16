// POST /api/v1/workspaces
import { handleWorkspaceRequest, createWorkspace } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await createWorkspace(userId, await readBody(event)) })),
)

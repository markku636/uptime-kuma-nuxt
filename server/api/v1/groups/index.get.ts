// GET /api/v1/groups
import { handleWorkspaceRequest, listGroups } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await listGroups(userId) })),
)

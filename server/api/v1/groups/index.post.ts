// POST /api/v1/groups
import { handleWorkspaceRequest, createGroup } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await createGroup(userId, await readBody(event)) })),
)

// POST /api/v1/workspaces/reorder  Body: { ids: number[] } (first to last)
import { handleWorkspaceRequest, reorderWorkspaces } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await reorderWorkspaces(userId, await readBody(event)) })),
)

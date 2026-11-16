// POST /api/v1/monitors/organize
// Body: { monitorIds: number[], parent?: number | null, workspaceId?: number | null }
import { handleWorkspaceRequest, organizeMonitors } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await organizeMonitors(userId, await readBody(event)) })),
)

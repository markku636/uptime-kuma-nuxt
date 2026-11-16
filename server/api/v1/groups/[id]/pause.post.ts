// POST /api/v1/groups/:id/pause  Pauses the group and every monitor inside it
import { handleWorkspaceRequest, getIdParam, setGroupActive } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await setGroupActive(userId, getIdParam(event), false) })),
)

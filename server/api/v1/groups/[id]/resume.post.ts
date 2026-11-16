// POST /api/v1/groups/:id/resume  Resumes the group and every monitor inside it
import { handleWorkspaceRequest, getIdParam, setGroupActive } from '~/server/services/workspace/service'

export default defineEventHandler(event =>
  handleWorkspaceRequest(event, async userId => ({ ok: true, data: await setGroupActive(userId, getIdParam(event), true) })),
)

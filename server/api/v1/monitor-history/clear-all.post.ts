import { requireWorkspace } from '../../../utils/workspace'
import { createClearHistory, clearJobDTO } from '../../../services/uptime/clear-history'

export default defineEventHandler(async (event) => {
  const scope = await requireWorkspace(event, 'owner')
  const job = await createClearHistory(scope.workspaceId)
  return { ok: true, data: clearJobDTO(job) }
})

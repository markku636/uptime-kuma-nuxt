import { z } from 'zod'
import { requireWorkspace } from '../../../utils/workspace'
import { createClearHistory, clearJobDTO } from '../../../services/uptime/clear-history'

const schema = z.object({ days: z.number().int().min(1).max(3650) })

export default defineEventHandler(async (event) => {
  const scope = await requireWorkspace(event, 'owner')
  const body = await readValidatedBody(event, schema.parse)
  const cutoff = new Date(Date.now() - body.days * 86_400_000)
  const job = await createClearHistory(scope.workspaceId, undefined, cutoff)
  return { ok: true, data: clearJobDTO(job) }
})

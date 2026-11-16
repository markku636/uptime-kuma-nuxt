// POST /api/v1/maintenances/preview — validate a maintenance form and return
// its status and next windows without saving
import { handleMaintenanceRequest, previewMaintenance } from '~/server/services/maintenance/service'

export default defineEventHandler(event =>
  handleMaintenanceRequest(event, async () => {
    const body = await readBody(event)
    return { ok: true, data: previewMaintenance(body) }
  }),
)

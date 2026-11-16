// PUT /api/v1/maintenances/:id
import { handleMaintenanceRequest, getMaintenanceIdParam, updateMaintenance } from '~/server/services/maintenance/service'

export default defineEventHandler(event =>
  handleMaintenanceRequest(event, async (userId) => {
    const id = getMaintenanceIdParam(event)
    const body = await readBody(event)
    return { ok: true, data: await updateMaintenance(userId, id, body) }
  }),
)

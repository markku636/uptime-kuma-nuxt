// DELETE /api/v1/maintenances/:id
import { handleMaintenanceRequest, getMaintenanceIdParam, deleteMaintenance } from '~/server/services/maintenance/service'

export default defineEventHandler(event =>
  handleMaintenanceRequest(event, async (userId) => {
    await deleteMaintenance(userId, getMaintenanceIdParam(event))
    return { ok: true }
  }),
)

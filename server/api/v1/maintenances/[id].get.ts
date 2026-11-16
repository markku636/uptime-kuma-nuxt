// GET /api/v1/maintenances/:id
import { handleMaintenanceRequest, getMaintenanceIdParam, getMaintenance } from '~/server/services/maintenance/service'

export default defineEventHandler(event =>
  handleMaintenanceRequest(event, async userId => ({
    ok: true,
    data: await getMaintenance(userId, getMaintenanceIdParam(event)),
  })),
)

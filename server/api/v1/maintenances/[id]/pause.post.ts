// POST /api/v1/maintenances/:id/pause
import { handleMaintenanceRequest, getMaintenanceIdParam, setMaintenanceActive } from '~/server/services/maintenance/service'

export default defineEventHandler(event =>
  handleMaintenanceRequest(event, async userId => ({
    ok: true,
    data: await setMaintenanceActive(userId, getMaintenanceIdParam(event), false),
  })),
)

// GET /api/v1/maintenances
import { handleMaintenanceRequest, listMaintenances } from '~/server/services/maintenance/service'

export default defineEventHandler(event =>
  handleMaintenanceRequest(event, async userId => ({ ok: true, data: await listMaintenances(userId) })),
)

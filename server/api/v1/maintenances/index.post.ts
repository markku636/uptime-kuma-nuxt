// POST /api/v1/maintenances
import { handleMaintenanceRequest, createMaintenance } from '~/server/services/maintenance/service'

export default defineEventHandler(event =>
  handleMaintenanceRequest(event, async (userId) => {
    const body = await readBody(event)
    return { ok: true, data: await createMaintenance(userId, body) }
  }),
)

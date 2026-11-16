// GET /api/v1/variables  (secret values are never returned)
import { handleVariableRequest, listVariables } from '~/server/services/variables/service'

export default defineEventHandler(event =>
  handleVariableRequest(event, async userId => ({ ok: true, data: await listVariables(userId) })),
)

// POST /api/v1/variables  Body: { name, value, secret?, workspaceId? }
import { handleVariableRequest, createVariable } from '~/server/services/variables/service'

export default defineEventHandler(event =>
  handleVariableRequest(event, async userId => ({ ok: true, data: await createVariable(userId, await readBody(event)) })),
)

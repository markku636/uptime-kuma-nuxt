// POST /api/v1/variables/bulk  Body: { workspaceId?, variables: [{ name, value, secret? }] } (create or update by name)
import { handleVariableRequest, saveVariables } from '~/server/services/variables/service'

export default defineEventHandler(event =>
  handleVariableRequest(event, async userId => ({ ok: true, data: await saveVariables(userId, await readBody(event)) })),
)

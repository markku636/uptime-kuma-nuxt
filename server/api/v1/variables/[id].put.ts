// PUT /api/v1/variables/:id  Body: { name?, value?, secret? } (omit value to keep it)
import { handleVariableRequest, getVariableId, updateVariable } from '~/server/services/variables/service'

export default defineEventHandler(event =>
  handleVariableRequest(event, async userId => ({
    ok: true,
    data: await updateVariable(userId, getVariableId(event), await readBody(event)),
  })),
)

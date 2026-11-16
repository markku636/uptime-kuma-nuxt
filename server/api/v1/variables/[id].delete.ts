// DELETE /api/v1/variables/:id
import { handleVariableRequest, getVariableId, deleteVariable } from '~/server/services/variables/service'

export default defineEventHandler(event =>
  handleVariableRequest(event, async (userId) => {
    await deleteVariable(userId, getVariableId(event))
    return { ok: true }
  }),
)

import { prisma } from '../../../utils/prisma'
import { requireWorkspace } from '../../../utils/workspace'
import { exportDeclarative } from '../../../services/monitoring-as-code'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  return { ok: true, data: await exportDeclarative(scope, prisma) }
})

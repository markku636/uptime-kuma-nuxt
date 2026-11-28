import { prisma } from '~/server/utils/prisma'
import { suiteDTO } from '~/server/services/bruno/test-definition'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const rows = await prisma.brunoTestSuite.findMany({
    where: { workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    orderBy: { id: 'desc' },
    take: 200,
  })
  return { ok: true, data: rows.map(suiteDTO) }
})

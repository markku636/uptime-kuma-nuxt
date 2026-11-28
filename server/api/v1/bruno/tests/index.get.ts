import { prisma } from '~/server/utils/prisma'
import { suiteDTO } from '~/server/services/bruno/test-definition'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const rows = await prisma.brunoTestSuite.findMany({
    where: { workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    orderBy: { id: 'desc' },
    take: 200,
  })
  const ids = rows.map(row => row.id)
  const recent = ids.length ? await prisma.brunoTestRun.findMany({
    where: { suiteId: { in: ids } },
    orderBy: { id: 'desc' },
    take: ids.length * 3,
    select: { suiteId: true, id: true, status: true, startedAt: true },
  }) : []
  const last = new Map<number, any>()
  for (const run of recent) if (!last.has(run.suiteId)) last.set(run.suiteId, run)
  return { ok: true, data: rows.map(row => ({ ...suiteDTO(row),
    lastRun: last.has(row.id) ? { id: String(last.get(row.id).id), status: last.get(row.id).status, startedAt: last.get(row.id).startedAt } : null,
  })) }
})

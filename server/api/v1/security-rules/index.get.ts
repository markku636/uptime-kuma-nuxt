import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const rows = await prisma.securityRule.findMany({
    where: { workspaceId: scope.workspaceId }, orderBy: { id: 'desc' }, take: 300,
  })
  return { ok: true, data: rows.map(row => ({ ...row,
    refs: Array.isArray(row.refs) ? row.refs : [], cwe: Array.isArray(row.cwe) ? row.cwe : [],
  })) }
})

import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  const rows = await prisma.securityRule.findMany({ where: { workspaceId: scope.workspaceId }, orderBy: { key: 'asc' }, take: 300 })
  const rules = rows.map(row => ({
    key: row.key, source: row.source, sourceUrl: row.sourceUrl, product: row.product,
    signature: row.signature, ...(row.maxVersion ? { maxVersion: row.maxVersion } : {}),
    severity: row.severity, title: row.title, detail: row.detail, recommendation: row.recommendation,
    refs: Array.isArray(row.refs) ? row.refs : [], cwe: Array.isArray(row.cwe) ? row.cwe : [], active: row.active,
  }))
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'content-disposition', 'attachment; filename="security-rules.json"')
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), rules }, null, 2)
})

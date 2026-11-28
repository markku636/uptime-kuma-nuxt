import { z } from 'zod'
import { requireRequestSession } from '../../../utils/request-session'

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).strict()

export default defineEventHandler(async event => {
  const scope = await requireRequestSession(event)
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) throw createError({ statusCode: 400, message: 'Invalid query' })

  const rows = await prisma.monitor.findMany({
    where: { workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true, name: true, url: true, tlsInfo: true },
    orderBy: { id: 'asc' },
    take: 500,
  })
  const certificates = rows.flatMap(monitor => {
    const info: any = monitor.tlsInfo
    if (!info || typeof info !== 'object' || Array.isArray(info) || !Number.isFinite(Number(info.daysRemaining))) return []
    return [{
      id: monitor.id, name: monitor.name,
      host: (() => { try { return new URL(monitor.url || '').hostname } catch { return '' } })(),
      daysRemaining: Number(info.daysRemaining),
      issuer: typeof info.issuer === 'string' ? info.issuer.slice(0, 200) : '',
      valid: info.valid === true,
    }]
  }).sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, query.data.limit)
  return { ok: true, data: certificates }
})

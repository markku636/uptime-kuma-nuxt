import { requirePlatformAdmin } from '../../../utils/request-session'

/** Bounded delivery log. Payloads are never returned — they may contain integration URLs. */
export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  const query = getQuery(event)
  const status = typeof query.status === 'string' && ['pending', 'processing', 'delivered', 'cancelled', 'dead'].includes(query.status)
    ? query.status
    : undefined
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 25))
  const cursor = typeof query.cursor === 'string' && /^\d{1,20}$/.test(query.cursor) ? BigInt(query.cursor) : undefined

  const rows = await prisma.notificationOutbox.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      eventType: true,
      status: true,
      attempts: true,
      errorCode: true,
      createdAt: true,
      completedAt: true,
      monitor: { select: { name: true } },
      notification: { select: { name: true } },
    },
  })
  const hasMore = rows.length > limit
  const page = hasMore ? rows[limit - 1] : undefined
  return {
    ok: true,
    data: rows.slice(0, limit).map(row => ({
      id: String(row.id),
      eventType: row.eventType,
      status: row.status,
      attempts: row.attempts,
      error: typeof row.errorCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(row.errorCode) ? row.errorCode : null,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() || null,
      monitor: row.monitor?.name || null,
      channel: row.notification?.name || null,
    })),
    page: { hasMore, nextCursor: hasMore && page ? String(page.id) : null },
  }
})

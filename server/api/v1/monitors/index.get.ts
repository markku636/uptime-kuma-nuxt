// server/api/v1/monitors/index.get.ts
// ?heartbeats=N (0-100, default 50): how many recent heartbeats to include per
// monitor. Pages that only need the current status ask for 1 (or 0), which
// keeps the response small when there are many monitors.

import type { Heartbeat } from '@prisma/client'

const DEFAULT_HEARTBEATS = 50
const MAX_HEARTBEATS = 100

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as { id?: number } | undefined)?.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const requested = Number.parseInt(String(getQuery(event).heartbeats ?? ''), 10)
  const take = Number.isInteger(requested) ? Math.min(Math.max(requested, 0), MAX_HEARTBEATS) : DEFAULT_HEARTBEATS

  const monitors = await prisma.monitor.findMany({
    where: { userId },
    include: {
      heartbeats: take > 0
        ? { take, orderBy: { time: 'desc' } }
        : false,
      tags: {
        include: { tag: true }
      }
    },
    orderBy: { weight: 'asc' }
  })

  // Convert BigInt to string for JSON serialization; always return an array
  const serializedMonitors = monitors.map(monitor => ({
    ...monitor,
    heartbeats: ((monitor as { heartbeats?: Heartbeat[] }).heartbeats ?? []).map(hb => ({
      ...hb,
      id: hb.id.toString()
    }))
  }))

  return {
    ok: true,
    data: serializedMonitors
  }
})

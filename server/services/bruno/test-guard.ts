import { createError } from 'h3'

/**
 * Bounds on-demand Bruno test runs. Each run can fan out to 20 external HTTP
 * requests, so a single workspace must not be able to saturate the worker.
 */
const MAX_ACTIVE = 2
const MAX_PER_MINUTE = 10
const active = new Set<number>()
const windows = new Map<number, { time: number; count: number }>()

export async function withTestRunCapacity<T>(userId: number, callback: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const previous = windows.get(userId)
  const window = previous && now - previous.time < 60_000 ? previous : { time: now, count: 0 }
  if (active.has(userId) || active.size >= MAX_ACTIVE || window.count >= MAX_PER_MINUTE) {
    throw createError({ statusCode: 429, message: 'Test run capacity reached; retry shortly' })
  }
  if (windows.size > 1000) for (const [id, value] of windows) if (now - value.time >= 60_000) windows.delete(id)
  window.count++
  windows.set(userId, window)
  active.add(userId)
  try {
    return await callback()
  } finally {
    active.delete(userId)
  }
}

export function testRunCapacity() {
  return { active: active.size, limit: MAX_ACTIVE, perMinute: MAX_PER_MINUTE }
}

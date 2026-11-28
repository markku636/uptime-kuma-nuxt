import { z } from 'zod'
import { requireWorkspace } from '../../../utils/workspace'
import { runBatchAudit } from '../../../services/site-audit/batch'

const batchInput = z.object({
  urls: z.array(z.string().trim().url().max(8192)).min(1).max(20),
  keyword: z.string().trim().min(1).max(200).optional(),
}).strict()

const WINDOW_MS = 60_000
const PER_USER = 5
const MAX_ACTIVE = 2
const windows = new Map<number, { time: number; count: number }>()
let active = 0

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = batchInput.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid batch audit request (1-20 URLs)' })

  const now = Date.now()
  const existing = windows.get(scope.user.id)
  const window = existing && now - existing.time < WINDOW_MS ? existing : { time: now, count: 0 }
  if (window.count >= PER_USER || active >= MAX_ACTIVE) {
    throw createError({ statusCode: 429, message: 'Batch audit capacity reached; retry shortly' })
  }
  window.count++
  windows.set(scope.user.id, window)
  active++
  try {
    const data = await runBatchAudit(parsed.data.urls, parsed.data.keyword)
    return { ok: true, data }
  } finally {
    active--
  }
})

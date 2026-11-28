// server/api/v1/security-scan/batch.post.ts
// 1–20 個網址的被動弱點檢查；有界併發、保留順序、單筆失敗隔離、不寫歷史。

import { z } from 'zod'
import { requireWorkspace } from '../../../utils/workspace'
import { runBatchSecurityScan, MAX_BATCH_URLS } from '../../../services/security-scan/batch'

const input = z.object({
  urls: z.array(z.string().trim().url().max(8192)).min(1).max(MAX_BATCH_URLS),
}).strict()

const WINDOW_MS = 60_000
const PER_USER = 3
const MAX_ACTIVE = 2
const windows = new Map<number, { time: number; count: number }>()
let active = 0

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = input.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid batch scan request' })

  const now = Date.now()
  const existing = windows.get(scope.user.id)
  const window = existing && now - existing.time < WINDOW_MS ? existing : { time: now, count: 0 }
  if (window.count >= PER_USER || active >= MAX_ACTIVE) {
    throw createError({ statusCode: 429, message: 'Batch scan capacity reached; retry shortly' })
  }
  window.count++
  windows.set(scope.user.id, window)
  active++
  try {
    return { ok: true, data: await runBatchSecurityScan(parsed.data.urls) }
  } finally {
    active--
  }
})

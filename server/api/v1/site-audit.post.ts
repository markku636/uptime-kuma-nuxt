import { z } from 'zod'
import { requireWorkspace } from '../../utils/workspace'
import { runSiteAudit, auditChecksSchema } from '../../services/site-audit/audit'

const auditInput = z.object({
  url: z.string().trim().url().max(8192),
  keyword: z.string().trim().min(1).max(200).optional(),
  checks: auditChecksSchema.optional(),
  linkLimit: z.number().int().min(1).max(20).optional(),
})

const WINDOW_MS = 60_000
const PER_USER = 10
const MAX_ACTIVE = 3
const windows = new Map<number, { time: number; count: number }>()
let active = 0

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = auditInput.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid audit request' })

  const now = Date.now()
  const existing = windows.get(scope.user.id)
  const window = existing && now - existing.time < WINDOW_MS ? existing : { time: now, count: 0 }
  if (window.count >= PER_USER || active >= MAX_ACTIVE) {
    throw createError({ statusCode: 429, message: 'Audit capacity reached; retry shortly' })
  }
  window.count++
  windows.set(scope.user.id, window)
  active++
  try {
    const report = await runSiteAudit(parsed.data)
    return { ok: true, data: report }
  } finally {
    active--
  }
})

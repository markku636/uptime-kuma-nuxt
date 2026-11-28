// server/api/v1/security-scan.post.ts
// 網站弱點掃描（on-demand）。被動模式任何人 editor 都能跑；
// active_light 一定要提出已經放在網站上的驗證 token，引擎本身也會再擋一次。

import { z } from 'zod'
import { requireWorkspace } from '../../utils/workspace'
import { runSecurityScan } from '../../services/security-scan/scan'
import { verifyOwnershipFor } from '../../services/security-scan/verify'
import { SECURITY_SCAN_PROFILES, SECURITY_SCAN_CATEGORIES } from '../../../shared/types/security-scan'

const categorySchema = z.object(Object.fromEntries(
  SECURITY_SCAN_CATEGORIES.map(id => [id, z.boolean().optional()]),
) as Record<typeof SECURITY_SCAN_CATEGORIES[number], z.ZodOptional<z.ZodBoolean>>).strict()

const scanInput = z.object({
  url: z.string().trim().url().max(8192),
  profile: z.enum(SECURITY_SCAN_PROFILES).optional(),
  verify: z.object({
    method: z.enum(['dns-txt', 'well-known']),
    token: z.string().min(16).max(128),
  }).strict().optional(),
  categories: categorySchema.optional(),
  maxProbes: z.number().int().min(0).max(6).optional(),
}).strict()

const WINDOW_MS = 60_000
const PER_USER = 5
const MAX_ACTIVE = 2
const windows = new Map<number, { time: number; count: number }>()
let active = 0

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = scanInput.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid security scan request' })

  const now = Date.now()
  const existing = windows.get(scope.user.id)
  const window = existing && now - existing.time < WINDOW_MS ? existing : { time: now, count: 0 }
  if (window.count >= PER_USER || active >= MAX_ACTIVE) {
    throw createError({ statusCode: 429, message: 'Scan capacity reached; retry shortly' })
  }
  window.count++
  windows.set(scope.user.id, window)
  active++
  try {
    const report = await runSecurityScan(parsed.data, {
      verifyOwnership: input => verifyOwnershipFor(input, scope.workspaceId),
    })
    return { ok: true, data: report }
  } finally {
    active--
  }
})

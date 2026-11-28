// server/api/v1/security-scan/verify-token.get.ts
// 取得「證明網站是我的」驗證碼；只發給 editor，token 90 天有效，可隨時重新取得（舊的作廢）。

import { z } from 'zod'
import { requireWorkspace } from '../../../utils/workspace'
import { issueVerifyToken } from '../../../services/security-scan/verify'

const querySchema = z.object({ url: z.string().trim().url().max(8192) })

const WINDOW_MS = 60_000
const PER_USER = 10
const windows = new Map<number, { time: number; count: number }>()

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid URL' })

  const now = Date.now()
  const existing = windows.get(scope.user.id)
  const window = existing && now - existing.time < WINDOW_MS ? existing : { time: now, count: 0 }
  if (window.count >= PER_USER) throw createError({ statusCode: 429, message: 'Too many verification tokens; retry shortly' })
  window.count++
  windows.set(scope.user.id, window)

  const issued = await issueVerifyToken(scope.workspaceId, parsed.data.url)
  return {
    ok: true,
    data: {
      ...issued,
      instructions: [
        `DNS TXT：在 ${issued.dnsName} 加入值 ${issued.dnsValue}`,
        `驗證檔：在 ${issued.wellKnownUrl} 放回傳的完整內容 ${issued.token}`,
        '任選一種放好後，掃描時選對應方式即可解鎖 active_light。',
      ],
    },
  }
})

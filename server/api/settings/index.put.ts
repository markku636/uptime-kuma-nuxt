import { z } from 'zod'
import { requirePlatformAdmin } from '../../utils/request-session'
import { encryptSecret } from '../../utils/variables'

const schema = z.object({
  cloudflareTunnelToken: z.string().max(2048).optional(),
  trustProxy: z.boolean().optional(),
})

const CONTEXT = 'settings:v1:cloudflare-tunnel-token'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  const body = await readValidatedBody(event, schema.parse)
  const updates: { key: string; value: string }[] = []

  if (body.cloudflareTunnelToken !== undefined) {
    const token = body.cloudflareTunnelToken.trim()
    updates.push({
      key: 'cloudflareTunnelToken',
      value: token ? encryptSecret(token, CONTEXT) : '',
    })
  }
  if (body.trustProxy !== undefined) {
    updates.push({ key: 'trustProxy', value: String(body.trustProxy) })
  }

  for (const { key, value } of updates) {
    await prisma.setting.upsert({
      where: { key },
      update: { value, type: key === 'trustProxy' ? 'boolean' : 'string' },
      create: { key, value, type: key === 'trustProxy' ? 'boolean' : 'string' },
    })
  }
  return { ok: true }
})

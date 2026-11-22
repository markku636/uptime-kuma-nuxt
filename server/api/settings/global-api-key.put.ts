import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requirePlatformAdmin, hashApiKey } from '../../utils/request-session'

const schema = z.object({ action: z.enum(['generate', 'revoke']) })

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const { action } = await readValidatedBody(event, schema.parse)

  if (action === 'revoke') {
    await prisma.setting.deleteMany({
      where: { key: { in: ['globalApiKeyHash', 'globalApiKeyPrefix', 'globalApiKeyOwner'] } },
    })
    return { ok: true }
  }

  const key = `gk_${randomBytes(24).toString('base64url')}`
  const prefix = key.slice(0, 7)
  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: 'globalApiKeyHash' }, update: { value: hashApiKey(key), type: 'string' }, create: { key: 'globalApiKeyHash', value: hashApiKey(key), type: 'string' } }),
    prisma.setting.upsert({ where: { key: 'globalApiKeyPrefix' }, update: { value: prefix, type: 'string' }, create: { key: 'globalApiKeyPrefix', value: prefix, type: 'string' } }),
    prisma.setting.upsert({ where: { key: 'globalApiKeyOwner' }, update: { value: String(session.user.id), type: 'string' }, create: { key: 'globalApiKeyOwner', value: String(session.user.id), type: 'string' } }),
  ])
  // The plaintext is returned exactly once; only its hash is persisted.
  return { ok: true, key, prefix }
})

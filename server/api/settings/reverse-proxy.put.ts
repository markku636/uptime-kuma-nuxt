// server/api/settings/reverse-proxy.put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  trustProxy: z.boolean().optional(),
  cloudflareTunnelToken: z.string().max(4096).optional(),
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readValidatedBody(event, schema.parse)
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue
    const type = typeof value === 'boolean' ? 'boolean' : 'string'
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value), type },
      create: { key, value: String(value), type },
    })
  }
  return { success: true }
})

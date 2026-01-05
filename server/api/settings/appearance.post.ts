// server/api/settings/appearance.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  theme: z.enum(['light', 'dark', 'system', 'auto']).optional(),
  primaryColor: z.string().optional(),
  uptimeDisplayStyle: z.enum(['percentage', 'nines']).optional(),
  heartbeatBarStyle: z.enum(['normal', 'bottom', 'none']).optional(),
  elapsedTimeStyle: z.enum(['no-line', 'with-line', 'none']).optional(),
  showCertificateExpiry: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readValidatedBody(event, schema.parse)

  // Upsert each setting
  const settingsToUpdate = Object.entries(body).filter(([_, value]) => value !== undefined)

  for (const [key, value] of settingsToUpdate) {
    const type = typeof value === 'boolean' ? 'boolean' : 'string'
    const stringValue = String(value)

    await prisma.setting.upsert({
      where: { key },
      update: { value: stringValue, type },
      create: { key, value: stringValue, type }
    })
  }

  return { success: true, message: 'Appearance settings saved' }
})

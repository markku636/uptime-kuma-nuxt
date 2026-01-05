// server/api/settings/general.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  displayTimezone: z.string().optional(),
  serverTimezone: z.string().optional(),
  searchEngineIndex: z.boolean().optional(),
  entryPage: z.enum(['dashboard', 'status']).optional(),
  primaryBaseUrl: z.string().optional(),
  steamApiKey: z.string().optional(),
  chromePath: z.string().optional(),
  dnsServers: z.string().optional(),
  trustProxy: z.boolean().optional(),
  nscd: z.boolean().optional(),
  keepDataPeriodDays: z.number().min(1).optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readValidatedBody(event, schema.parse)

  // Upsert each setting
  const settingsToUpdate = Object.entries(body).filter(([_, value]) => value !== undefined)

  for (const [key, value] of settingsToUpdate) {
    let type = 'string'
    if (typeof value === 'boolean') type = 'boolean'
    else if (typeof value === 'number') type = 'number'
    
    const stringValue = String(value)

    await prisma.setting.upsert({
      where: { key },
      update: { value: stringValue, type },
      create: { key, value: stringValue, type }
    })
  }

  return { success: true, message: 'General settings saved' }
})

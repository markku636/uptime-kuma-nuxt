// server/api/settings/general.post.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const timezone = z.string().max(100).refine(value => {
  if (value === 'auto') return true
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}, 'Invalid IANA timezone')

const schema = z.object({
  displayTimezone: timezone.optional(),
  serverTimezone: timezone.optional(),
  searchEngineIndex: z.boolean().optional(),
  entryPage: z.enum(['dashboard', 'status', 'statusPage']).optional(),
  statusPageSlug: z.string().max(200).optional(),
  primaryBaseUrl: z.string().optional(),
  steamApiKey: z.string().optional(),
  chromePath: z.string().optional(),
  dnsServers: z.string().optional(),
  trustProxy: z.boolean().optional(),
  nscd: z.boolean().optional(),
  keepDataPeriodDays: z.number().min(1).optional(),
  checkUpdate: z.boolean().optional(),
  checkBeta: z.boolean().optional(),
  showRuntimeHints: z.boolean().optional(),
  alertDelayMinutes: z.number().int().min(0).max(1440).optional(),
  autoIncidentOnDown: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireRequestSession(event)
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

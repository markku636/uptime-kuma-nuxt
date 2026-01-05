// server/api/v1/settings/tls-expiry.put.ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  days: z.array(z.number().min(1))
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readValidatedBody(event, schema.parse)

  // Sort days in ascending order
  const sortedDays = [...body.days].sort((a, b) => a - b)

  await prisma.setting.upsert({
    where: { key: 'tlsExpiryDays' },
    update: { value: JSON.stringify(sortedDays), type: 'json' },
    create: { key: 'tlsExpiryDays', value: JSON.stringify(sortedDays), type: 'json' }
  })

  return { success: true, days: sortedDays }
})

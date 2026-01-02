import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const proxySchema = z.object({
  protocol: z.enum(['http', 'https', 'socks', 'socks5']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  auth: z.boolean().default(false),
  username: z.string().optional(),
  password: z.string().optional(),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false)
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)

  const data = proxySchema.parse(body)

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.proxy.updateMany({
      where: {
        userId: session.user.id,
        isDefault: true
      },
      data: {
        isDefault: false
      }
    })
  }

  const proxy = await prisma.proxy.create({
    data: {
      ...data,
      userId: session.user.id
    }
  })

  return proxy
})

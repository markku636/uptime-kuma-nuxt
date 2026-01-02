import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const updateProxySchema = z.object({
  protocol: z.enum(['http', 'https', 'socks', 'socks5']).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  auth: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional()
}).partial()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = parseInt(getRouterParam(event, 'id') || '')
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid proxy ID'
    })
  }

  // Verify ownership
  const existing = await prisma.proxy.findFirst({
    where: {
      id,
      userId: session.user.id
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Proxy not found'
    })
  }

  const data = updateProxySchema.parse(body)

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.proxy.updateMany({
      where: {
        userId: session.user.id,
        isDefault: true,
        id: { not: id }
      },
      data: {
        isDefault: false
      }
    })
  }

  const proxy = await prisma.proxy.update({
    where: { id },
    data
  })

  return proxy
})

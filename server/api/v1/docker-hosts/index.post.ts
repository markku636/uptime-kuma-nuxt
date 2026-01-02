import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const dockerHostSchema = z.object({
  name: z.string().min(1),
  dockerType: z.enum(['socket', 'tcp']),
  dockerDaemon: z.string().optional(),
  connectionUrl: z.string().optional(),
  active: z.boolean().default(true)
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)

  const data = dockerHostSchema.parse(body)

  // Validate connection parameters based on type
  if (data.dockerType === 'socket' && !data.dockerDaemon) {
    throw createError({
      statusCode: 400,
      message: 'Docker socket path is required for socket connection type'
    })
  }

  if (data.dockerType === 'tcp' && !data.connectionUrl) {
    throw createError({
      statusCode: 400,
      message: 'Docker TCP URL is required for TCP connection type'
    })
  }

  const dockerHost = await prisma.dockerHost.create({
    data: {
      ...data,
      userId: session.user.id
    }
  })

  return dockerHost
})

import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const updateDockerHostSchema = z.object({
  name: z.string().min(1).optional(),
  dockerType: z.enum(['socket', 'tcp']).optional(),
  dockerDaemon: z.string().optional(),
  connectionUrl: z.string().optional(),
  active: z.boolean().optional()
}).partial()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = parseInt(getRouterParam(event, 'id') || '')
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Docker host ID'
    })
  }

  // Verify ownership
  const existing = await prisma.dockerHost.findFirst({
    where: {
      id,
      userId: session.user.id
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Docker host not found'
    })
  }

  const data = updateDockerHostSchema.parse(body)

  const dockerHost = await prisma.dockerHost.update({
    where: { id },
    data
  })

  return dockerHost
})

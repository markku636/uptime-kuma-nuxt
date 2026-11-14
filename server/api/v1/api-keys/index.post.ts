// server/api/v1/api-keys/index.post.ts
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { hashApiKey } from '../../../utils/request-session'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100),
  expires: z.string().datetime().optional(),
  scope: z.enum(['read', 'write']).default('read'),
  environmentId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireWorkspace(event, 'owner')
  const body = await readValidatedBody(event, schema.parse)

  if (body.environmentId && !await prisma.environment.findFirst({ where: { id: body.environmentId, workspaceId: session.workspaceId } })) {
    throw createError({ statusCode: 404, message: 'Environment not found' })
  }
  // Generate a unique API key
  const keyValue = `uk_${nanoid(32)}`

  const apiKey = await prisma.apiKey.create({
    data: { name: body.name, key: hashApiKey(keyValue), expires: body.expires ? new Date(body.expires) : null, active: true, scope: body.scope, environmentId: body.environmentId, workspaceId: session.workspaceId, userId: session.user.id }
  })

  // Return the key value only once at creation time
  return {
    id: apiKey.id,
    name: apiKey.name,
    key: keyValue,
    createdAt: apiKey.createdAt,
    expires: apiKey.expires, scope: apiKey.scope, environmentId: apiKey.environmentId
  }
})

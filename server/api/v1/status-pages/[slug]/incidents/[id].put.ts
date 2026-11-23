import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const updateIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(10000),
  style: z.enum(['info', 'warning', 'danger', 'success', 'primary', 'light', 'dark']).default('warning'),
  pin: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const scope = await requireWorkspace(event, 'editor')
  const slug = getRouterParam(event, 'slug')
  const id = Number(getRouterParam(event, 'id'))
  if (!slug) throw createError({ statusCode: 400, message: 'Slug is required' })
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid incident ID' })

  const statusPage = await prisma.statusPage.findFirst({
    where: { slug, workspaceId: scope.workspaceId },
    select: { id: true },
  })
  if (!statusPage) throw createError({ statusCode: 404, message: 'Status page not found' })

  const incident = await prisma.incident.findFirst({
    where: { id, statusPageId: statusPage.id },
    select: { id: true },
  })
  if (!incident) throw createError({ statusCode: 404, message: 'Incident not found' })

  const body = await readValidatedBody(event, updateIncidentSchema.parse)
  const updated = await prisma.incident.update({
    where: { id },
    data: body,
  })
  return {
    ok: true,
    data: { ...updated, createdDate: updated.createdAt, lastUpdatedDate: updated.updatedAt },
  }
})

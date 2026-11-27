import { prisma } from '~/server/utils/prisma'
import { requireStatusPageEditor } from '~/server/utils/status-page-editor'
import { parseIncidentUpdateMessage, parseIncidentUpdateStatus } from '~/server/utils/incident-updates'

export default defineEventHandler(async event => {
  const scope = await requireStatusPageEditor(event)

  const slug = getRouterParam(event, 'slug')
  const incidentId = Number(getRouterParam(event, 'id'))
  if (!slug || !Number.isSafeInteger(incidentId) || incidentId < 1) {
    throw createError({ statusCode: 400, message: 'Invalid incident' })
  }

  const statusPage = await prisma.statusPage.findFirst({ where: { slug, workspaceId: scope.workspaceId }, select: { id: true } })
  if (!statusPage) throw createError({ statusCode: 404, message: 'Status page not found' })
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, statusPageId: statusPage.id }, select: { id: true } })
  if (!incident) throw createError({ statusCode: 404, message: 'Incident not found' })

  const body = await readBody(event)
  const status = parseIncidentUpdateStatus(body?.status) || 'update'
  const message = parseIncidentUpdateMessage(body?.message)
  if (!message) throw createError({ statusCode: 400, message: 'Message is required (max 5000 characters)' })

  const [created] = await prisma.$transaction([
    prisma.incidentUpdate.create({ data: { incidentId, status, message } }),
    prisma.incident.update({ where: { id: incidentId }, data: { updatedAt: new Date() } }),
  ])
  return {
    ok: true,
    data: {
      id: created.id,
      status: created.status,
      message: created.message,
      createdDate: created.createdAt.toISOString(),
    },
  }
})

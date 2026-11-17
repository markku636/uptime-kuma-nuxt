// server/api/v1/monitors/[id]/screenshot.png.get.ts
import { prisma } from '~/server/utils/prisma'
import { getScreenshot } from '~/server/services/monitor/screenshots'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const owned = await prisma.monitor.count({ where: { id, userId } })
  const shot = owned ? getScreenshot(id) : null
  if (!shot) throw createError({ statusCode: 404, message: 'No screenshot' })

  setResponseHeader(event, 'Content-Type', 'image/png')
  setResponseHeader(event, 'Cache-Control', 'private, max-age=60')
  return shot.png
})

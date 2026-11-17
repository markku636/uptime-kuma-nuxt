// server/api/v1/monitors/[id]/screenshot.get.ts
// The latest screenshot of a real-browser monitor: JSON with the image URL
// and capture time (the image itself is screenshot.png next to it).
import { prisma } from '~/server/utils/prisma'
import { getScreenshot } from '~/server/services/monitor/screenshots'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid monitor ID' })
  const owned = await prisma.monitor.count({ where: { id, userId } })
  if (!owned) throw createError({ statusCode: 404, message: 'Monitor not found' })

  const shot = getScreenshot(id)
  if (!shot) throw createError({ statusCode: 404, message: 'No screenshot yet: one is taken at the next check' })
  return {
    url: `/api/v1/monitors/${id}/screenshot.png?t=${shot.time.getTime()}`,
    timestamp: shot.time.toISOString(),
  }
})

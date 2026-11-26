import { createHash } from 'node:crypto'
import { z } from 'zod'

const bodySchema = z
  .object({ viewportLabel: z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/) })
  .strict()

export default defineEventHandler(async (event) => {
  const scope = await requireRequestSession(event)
  const id = parseBoundedQuery(z.coerce.number().int().positive(), getRouterParam(event, 'id'))
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0].message })
  }
  const { viewportLabel } = parsed.data

  const monitor = await prisma.monitor.findFirst({
    where: { id, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    select: { id: true, configVersion: true },
  })
  if (!monitor) throw createError({ statusCode: 404, message: 'Monitor not found' })

  const artifact = await prisma.visualCheckArtifact.findFirst({
    where: { monitorId: id, viewportLabel },
    orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
  })
  if (!artifact?.currentImage) {
    throw createError({ statusCode: 400, message: '這個 viewport 還沒有可接受的截圖' })
  }

  const image = Buffer.from(artifact.currentImage)
  const sha256 = createHash('sha256').update(image).digest('hex')
  const metrics = (artifact.metrics ?? {}) as Record<string, any>
  const width = Number(metrics?.viewports?.width ?? 0)
  const height = Number(metrics?.viewports?.height ?? 0)

  await prisma.visualBaseline.upsert({
    where: { monitorId_viewportLabel: { monitorId: id, viewportLabel } },
    create: {
      monitorId: id,
      viewportLabel,
      width,
      height,
      image: new Uint8Array(image),
      sha256,
      configVersion: monitor.configVersion,
    },
    update: {
      width,
      height,
      image: new Uint8Array(image),
      sha256,
      configVersion: monitor.configVersion,
    },
  })

  return { ok: true, data: { viewportLabel, sha256, configVersion: monitor.configVersion } }
})

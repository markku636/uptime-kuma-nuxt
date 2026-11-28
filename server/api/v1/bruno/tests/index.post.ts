import { prisma } from '~/server/utils/prisma'
import { brunoTestInputSchema } from '~/server/utils/bruno-test-input'
import { prepareTestSuite, verifyDigest, sealTestSecrets, suiteDTO } from '~/server/services/bruno/test-definition'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = brunoTestInputSchema.safeParse(await readBody(event))
  if (!parsed.success || !parsed.data.digest || !parsed.data.name) {
    throw createError({ statusCode: 400, message: 'Name and original preview digest are required' })
  }
  const body = parsed.data
  if (body.secrets && Object.keys(body.secrets).length && !(scope.role === 'owner' && event.context.authMethod === 'session')) {
    throw createError({ statusCode: 403, message: 'Only an owner session can supply new suite secrets' })
  }
  const manifest = { collectionId: body.collectionId, sourceEnvironment: body.sourceEnvironment, files: body.files, mode: 'create' as const }
  const prepared = await prepareTestSuite(scope, manifest, { variables: body.variables, secrets: body.secrets })
  if (!prepared.ok) throw createError({ statusCode: 400, message: 'Bruno test collection is not supported', data: { issues: prepared.issues } })
  const digest = body.digest!
  if (!verifyDigest(prepared, digest)) throw createError({ statusCode: 409, message: 'Preview changed; preview the original files again' })

  const definition = { ...prepared.definition, failFast: body.failFast ?? true, timeoutSec: body.timeoutSec ?? 180 }
  const existing = await prisma.brunoTestSuite.findFirst({
    where: { workspaceId: scope.workspaceId, environmentId: scope.environmentId, collectionId: body.collectionId, name: body.name },
    select: { id: true },
  })
  if (existing) throw createError({ statusCode: 409, message: 'A test suite with this name already exists' })
  const row = await prisma.brunoTestSuite.create({
    data: {
      workspaceId: scope.workspaceId, environmentId: scope.environmentId, collectionId: body.collectionId,
      name: body.name!, definition: definition as any, sourceFingerprint: prepared.digest, createdBy: scope.user.id,
      testSecrets: sealTestSecrets(scope.workspaceId, scope.environmentId, body.collectionId, body.secrets || {}),
    },
  })
  return { ok: true, data: suiteDTO(row) }
})

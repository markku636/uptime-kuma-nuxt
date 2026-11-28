import { brunoTestInputSchema } from '~/server/utils/bruno-test-input'
import { prepareTestSuite } from '~/server/services/bruno/test-definition'
import { withBrunoCapacity } from '~/server/services/bruno/guard'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const parsed = brunoTestInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid Bruno test manifest' })
  const { digest: _digest, ...body } = parsed.data
  const manifest = { collectionId: body.collectionId, sourceEnvironment: body.sourceEnvironment, files: body.files, mode: 'create' as const }
  return withBrunoCapacity(scope.user.id, () => prepareTestSuite(scope, manifest, { variables: body.variables, secrets: body.secrets }))
})

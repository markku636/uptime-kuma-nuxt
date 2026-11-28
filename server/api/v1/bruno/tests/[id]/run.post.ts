import { runBrunoTestSuite } from '~/server/services/bruno/test-runner'

export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, message: 'Invalid test suite id' })
  return runBrunoTestSuite(scope, id)
})

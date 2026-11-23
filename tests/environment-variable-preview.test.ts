import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previewEnvironmentVariables } from '../utils/variable-preview'

test('environment variable preview masks secrets and reports unknown names', () => {
  assert.deepEqual(
    previewEnvironmentVariables('{{baseUrl}}/health?token={{apiKey}}&x={{missing}}',
      { baseUrl: 'https://example.com', apiKey: 'SUPER_SECRET' }, ['apiKey']),
    { preview: 'https://example.com/health?token=••••••&x={{missing}}', missing: ['missing'] },
  )
  assert.deepEqual(
    previewEnvironmentVariables('no variables', {}, []),
    { preview: 'no variables', missing: [] },
  )
})

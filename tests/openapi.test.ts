import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openapi } from '../server/utils/openapi'

test('OpenAPI documents status-page incident and maintenance APIs', () => {
  const paths = openapi.paths as Record<string, any>
  for (const path of [
    '/v1/status-pages',
    '/v1/status-pages/{slug}',
    '/v1/status-pages/{slug}/incidents',
    '/v1/status-pages/{slug}/incidents/{id}/updates',
    '/v1/status-pages/{slug}/maintenances',
  ]) assert.ok(paths[path], `missing ${path}`)
  assert.equal(paths['/v1/status-pages/{slug}/incidents/{id}/updates'].post.summary.includes('editor'), true)
})

test('OpenAPI documents escalation and noindex fields', () => {
  const schemas = openapi.components.schemas as Record<string, any>
  assert.ok(schemas.Monitor.properties.notificationDelays)
  assert.ok(schemas.Monitor.properties.notifications)
  assert.equal(schemas.StatusPage.properties.noIndex.default, false)
  assert.deepEqual(schemas.IncidentUpdate.properties.status.enum, ['investigating', 'identified', 'monitoring', 'resolved', 'update'])
})

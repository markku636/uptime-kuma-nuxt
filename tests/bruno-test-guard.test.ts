import assert from 'node:assert/strict'
import { test } from 'node:test'
import { testRunCapacity, withTestRunCapacity } from '../server/services/bruno/test-guard'

test('test run capacity releases the slot even on failure', async () => {
  const before = testRunCapacity().active
  await assert.rejects(withTestRunCapacity(12345, async () => { throw new Error('boom') }), /boom/)
  assert.equal(testRunCapacity().active, before)
})

test('one user cannot hold two on-demand runs at once', async () => {
  let releaseFirst!: () => void
  const first = withTestRunCapacity(54321, () => new Promise<void>(resolve => { releaseFirst = resolve }))
  await assert.rejects(withTestRunCapacity(54321, async () => 1), /capacity reached/)
  releaseFirst()
  await first
  assert.equal(testRunCapacity().active, 0)
})

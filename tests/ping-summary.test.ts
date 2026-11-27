import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recentAveragePing } from '../utils/ping-summary'

test('recent average ping ignores failed rows and out-of-range values', () => {
  assert.equal(recentAveragePing([{ ping: 100 }, { ping: 200 }, { ping: null }]), 150)
  assert.equal(recentAveragePing([{ ping: -1 }, { ping: 400000 }]), null)
  assert.equal(recentAveragePing(null), null)
})

test('recent average ping uses only the latest bounded window', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ ping: i + 1 }))
  assert.equal(recentAveragePing(rows, 10), 16)
})

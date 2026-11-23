import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPushStale, pushGraceMs } from '../server/services/monitor/push-watchdog'

test('push watchdog uses a 2x interval grace with a 60s floor', () => {
  assert.equal(pushGraceMs(60), 120_000)
  assert.equal(pushGraceMs(10), 60_000)
  assert.equal(pushGraceMs(300), 600_000)
  const now = Date.UTC(2026, 10, 23, 1, 0, 0)
  assert.equal(isPushStale(60, new Date(now - 119_000), now), false)
  assert.equal(isPushStale(60, new Date(now - 120_000), now), true)
  assert.equal(isPushStale(60, 'invalid', now), false)
})

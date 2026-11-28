import { test } from 'node:test'
import assert from 'node:assert/strict'
import { raiseStatusByIncidents } from '../server/services/status-page/overall-status'

test('open incidents raise the banner according to their impact', () => {
  assert.equal(raiseStatusByIncidents('operational', [{ impact: 'major' }]), 'major-outage')
  assert.equal(raiseStatusByIncidents('partial-outage', [{ impact: 'degraded' }]), 'partial-outage')
  assert.equal(raiseStatusByIncidents('operational', [{ impact: 'degraded' }, { impact: 'partial' }]), 'partial-outage')
  assert.equal(raiseStatusByIncidents('major-outage', [{ impact: 'maintenance' }]), 'major-outage')
})

test('resolved or impactless incidents do not change the banner', () => {
  assert.equal(raiseStatusByIncidents('operational', [{ impact: 'major', updates: [{ status: 'resolved' }] }]), 'operational')
  assert.equal(raiseStatusByIncidents('operational', [{ impact: 'none' }]), 'operational')
})

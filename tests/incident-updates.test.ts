import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseIncidentUpdateMessage, parseIncidentUpdateStatus } from '../server/utils/incident-updates'

test('incident update status accepts only the documented states', () => {
  for (const status of ['investigating', 'identified', 'monitoring', 'resolved', 'update']) {
    assert.equal(parseIncidentUpdateStatus(status), status)
  }
  assert.equal(parseIncidentUpdateStatus('UP'), null)
  assert.equal(parseIncidentUpdateStatus(1), null)
  assert.equal(parseIncidentUpdateStatus(''), null)
})

test('incident update message is trimmed and bounded', () => {
  assert.equal(parseIncidentUpdateMessage('  investigating the issue  '), 'investigating the issue')
  assert.equal(parseIncidentUpdateMessage(''), null)
  assert.equal(parseIncidentUpdateMessage('x'.repeat(5001)), null)
  assert.equal(parseIncidentUpdateMessage({ text: 'no' }), null)
})

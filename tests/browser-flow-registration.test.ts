import { test } from 'node:test'
import assert from 'node:assert/strict'
import { supportedScheduledTypes } from '../server/services/monitor/runtime-config'
import { monitorSummary } from '../server/utils/serialize'
import { getMonitorType } from '../server/services/monitor/types'

const base = {
  id: 1, workspaceId: 1, environmentId: 1, name: 'flow', type: 'browser-flow', active: true,
  interval: 60, retryInterval: 60, timeout: 30, maxretries: 0, weight: 1000,
  createdAt: new Date(), parent: null, groupId: null, tags: [], heartbeats: [],
}

test('browser-flow is a scheduled type and appears as scheduled in list DTOs', () => {
  assert.equal(supportedScheduledTypes.includes('browser-flow'), true)
  const dto = monitorSummary(base)
  assert.equal(dto.scheduleSupported, true)
  assert.equal(dto.runtimeStatus, 'scheduled')
})

test('browser-flow has monitor type metadata instead of falling back to basic', () => {
  const type = getMonitorType('browser-flow')
  assert.equal(type.supportsConditions, true)
  assert.equal(type.conditionVariables?.some(variable => variable.id === 'response_time'), true)
})

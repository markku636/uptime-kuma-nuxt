import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatMessage } from '../server/services/notification/sender'

const monitor = { id: 9, name: 'My site' }
const base = { status: 0, ping: 80, time: new Date().toISOString() }

test('audit and flow alerts include the reason in the body', () => {
  const audit = formatMessage(monitor, { ...base, code: 'AUDIT_LOW', msg: 'Audit 42/100 (D) · fail: headers' })
  assert.equal(audit.body, 'DOWN · AUDIT_LOW · Audit 42/100 (D) · fail: headers')
  const flow = formatMessage(monitor, { ...base, code: 'FLOW_STEP_FAILED', msg: 'Step 2/3 (click) failed: ELEMENT_NOT_FOUND' })
  assert.equal(flow.body, 'DOWN · FLOW_STEP_FAILED · Step 2/3 (click) failed: ELEMENT_NOT_FOUND')
})

test('ordinary checks keep the compact body', () => {
  const plain = formatMessage(monitor, { ...base, code: 'HTTP_STATUS', msg: 'State changed' })
  assert.equal(plain.body, 'DOWN · HTTP_STATUS')
  const up = formatMessage(monitor, { ...base, status: 1, code: 'AUDIT_OK', msg: 'State changed' })
  assert.equal(up.body, 'UP · AUDIT_OK')
})

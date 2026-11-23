import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_TLS_EXPIRY_DAYS, parseTlsExpiryDays } from '../server/utils/tls-expiry-settings'

test('TLS expiry settings parse JSON, legacy CSV and invalid values', () => {
  assert.deepEqual(parseTlsExpiryDays('[3,1,7,3]'), [1, 3, 7])
  assert.deepEqual(parseTlsExpiryDays('7,14,21'), [7, 14, 21])
  assert.deepEqual(parseTlsExpiryDays([14, 7]), [7, 14])
  assert.deepEqual(parseTlsExpiryDays(undefined), DEFAULT_TLS_EXPIRY_DAYS)
  assert.deepEqual(parseTlsExpiryDays('not json'), DEFAULT_TLS_EXPIRY_DAYS)
  assert.deepEqual(parseTlsExpiryDays([0, 400, -1, 2.5]), DEFAULT_TLS_EXPIRY_DAYS)
})

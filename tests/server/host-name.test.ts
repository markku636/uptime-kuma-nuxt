import { describe, expect, it } from 'vitest'
import { isSafeHostName } from '../../server/services/monitor/checkers/host-name'

describe('isSafeHostName', () => {
  it('accepts names and addresses', () => {
    for (const h of ['example.com', 'my-host_1.internal', '10.0.0.1', '::1', 'fe80::1%eth0', '2001:db8::1', 'localhost']) {
      expect(isSafeHostName(h), h).toBe(true)
    }
  })

  it('rejects anything a shell or the tool could interpret', () => {
    for (const h of ['a.com; rm -rf /', 'a.com && id', '$(id)', '`id`', 'a.com|nc x 1', '-f', '--help', 'a com', 'a.com\nid', '', '   ', null, 42]) {
      expect(isSafeHostName(h), String(h)).toBe(false)
    }
  })
})

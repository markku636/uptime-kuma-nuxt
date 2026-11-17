// Kafka monitors: no broker on the port gives a clean DOWN, and the monitor's
// broker list is not modified between checks
import { describe, expect, it } from 'vitest'
import { checkKafka } from '../../server/services/monitor/checkers/message-queue-checker'

describe('checkKafka', () => {
  it('fails cleanly and leaves the monitor alone', async () => {
    const monitor = { hostname: '127.0.0.1', port: 9, kafkaBrokers: [] as string[], timeout: 1 }
    const first = await checkKafka(monitor, Date.now())
    await checkKafka(monitor, Date.now())
    expect(first.status).toBe(0)
    expect(monitor.kafkaBrokers).toEqual([])
  }, 30_000)
})

describe('useTls', async () => {
  const { useTls } = await import('../../server/services/monitor/checkers/message-queue-checker')
  it('follows the standard ports, else the monitor setting', () => {
    expect(useTls(8883, 8883, 1883, true)).toBe(true)
    expect(useTls(1883, 8883, 1883, false)).toBe(false)
    expect(useTls(8884, 8883, 1883, false)).toBe(true)
    expect(useTls(8884, 8883, 1883, true)).toBe(false)
  })
})

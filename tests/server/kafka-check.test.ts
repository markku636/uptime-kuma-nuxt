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

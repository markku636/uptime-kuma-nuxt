import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimMonitors } from '../server/services/monitor/leases'
import { supportedScheduledTypes } from '../server/services/monitor/runtime-config'

test('visual-diff 是 worker 可認領的排程型別', async () => {
  assert.ok(supportedScheduledTypes.includes('visual-diff'))

  // 假的 DB 只在認領 SQL 含 visual-diff 時回傳候選；漏加型別時測試會拿到空 leases。
  let sql = ''
  const tx: any = {
    $queryRaw: async (first: any) => {
      sql = typeof first === 'string' ? first : String(first?.strings?.join('?') ?? '')
      return sql.includes("'visual-diff'") ? [{ id: 1 }] : []
    },
    monitor: {
      findMany: async () => [
        { id: 1, type: 'visual-diff', configVersion: 1, scheduledFor: new Date(), workspaceId: 1, environmentId: 1 },
      ],
    },
  }
  const db: any = { $transaction: async (fn: any) => fn(tx) }
  const leases = await claimMonitors('test-worker', 1, 5000, db)
  assert.equal(leases.length, 1, 'claimMonitors 必須認領 visual-diff')
  assert.equal(leases[0].id, 1)
})

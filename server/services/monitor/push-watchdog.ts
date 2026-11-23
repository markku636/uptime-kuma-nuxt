import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { workerPrisma } from '../../utils/worker-prisma'
import { commitMonitorResult } from './commit-result'
import { isMonitorUnderMaintenance } from '../maintenance/scheduler'

/** Push monitors are expected to check in every `interval` seconds; allow 2x + a 60s floor. */
export function pushGraceMs(intervalSeconds: number) {
  return Math.max(60_000, Math.max(1, Math.floor(Number(intervalSeconds) || 60)) * 2000)
}

export function isPushStale(intervalSeconds: number, lastCheckedAt: Date | string | number, now = Date.now()) {
  const time = lastCheckedAt instanceof Date ? lastCheckedAt.getTime() : new Date(lastCheckedAt).getTime()
  return Number.isFinite(time) && now - time >= pushGraceMs(intervalSeconds)
}

/** Marks missed push heartbeats DOWN so the existing notification outbox can alert. */
export class PushWatchdog {
  private timer: NodeJS.Timeout | undefined
  private running = false
  constructor(private db: any = workerPrisma, private pollMs = 30_000) {}

  start() {
    this.timer = setInterval(() => void this.poll(), this.pollMs)
    this.timer.unref()
    void this.poll()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  async poll() {
    if (this.running) return
    this.running = true
    try {
      const rows = await this.db.$queryRaw<Array<{ id: number }>>`
        SELECT m.id FROM monitors m
        JOIN monitor_states s ON s.monitor_id = m.id
        WHERE m.type = 'push' AND m.active AND s.status <> 0
          AND s.checked_at < clock_timestamp() - (GREATEST(60, m.interval * 2) * INTERVAL '1 second')
        ORDER BY s.checked_at ASC LIMIT 100`
      for (const row of rows) {
        try {
          await this.markDown(Number(row.id))
        } catch (error) {
          console.warn('[PushWatchdog] failed to mark missed heartbeat', row.id, error)
        }
      }
    } catch {
      // Transient DB failures are retried on the next poll.
    } finally {
      this.running = false
    }
  }

  private async markDown(id: number) {
    await this.db.$transaction(async (tx: any) => {
      // Lock the monitor so multiple workers cannot emit duplicate down alerts.
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM monitors WHERE id = ${id} AND type = 'push' AND active FOR UPDATE`
      if (!locked.length) return
      const monitor = await tx.monitor.findUniqueOrThrow({ where: { id } })
      const state = await tx.monitorState.findUnique({ where: { monitorId: id } })
      if (!state || state.status === 0) return
      // Planned downtime suppresses missed-heartbeat alerts just like active checks.
      if (await isMonitorUnderMaintenance(id, monitor.workspaceId, tx)) return
      const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!.now
      if (!isPushStale(monitor.interval, state.checkedAt, now.getTime())) return
      await commitMonitorResult(tx, { ...monitor, runId: randomUUID(), scheduledFor: now }, {
        status: 0,
        ping: 0,
        msg: 'Heartbeat not received',
        code: 'PUSH_MISSED',
      })
      await tx.$executeRaw(Prisma.sql`SELECT pg_notify('uptime_monitor_state',${String(id)})`)
    }, { timeout: 10_000, maxWait: 5000 })
  }
}

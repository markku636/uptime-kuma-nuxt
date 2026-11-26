import {requirePlatformAdmin} from '../../../utils/request-session'
import {runtimeWorker,runtimeDispatcher,runtimeBridge,runtimeState} from '../../../services/monitor/runtime'
import {runtimeOptions,workerInstanceId,supportedScheduledTypes} from '../../../services/monitor/runtime-config'

const OFFLINE_AFTER_MS = 30000
// Stopped instances stay in worker_instances for 7 days; only recent ones are worth showing.
const RECENT_STOPPED_MS = 24 * 3600 * 1000

type Queue = {scheduled: number; due: number; oldestDueMs: number | null}

function instanceState(row: {draining: boolean; lastSeen: Date}, now: number) {
  if (row.draining) return 'draining'
  return now - row.lastSeen.getTime() > OFFLINE_AFTER_MS ? 'offline' : 'running'
}

export default defineEventHandler(async event => {
  await requirePlatformAdmin(event)
  const [rows, pending, dead, unsupported, [queue]] = await Promise.all([
    prisma.workerInstance.findMany({where: {lastSeen: {gt: new Date(Date.now() - RECENT_STOPPED_MS)}}, orderBy: {startedAt: 'desc'}, take: 200}),
    prisma.notificationOutbox.count({where: {status: {in: ['pending', 'processing']}}}),
    prisma.notificationOutbox.count({where: {status: 'dead'}}),
    prisma.monitor.groupBy({by: ['type'], where: {active: true, type: {notIn: supportedScheduledTypes}}, _count: {id: true}}),
    // Same predicate as the worker claim query (monitors_due_idx), so "due" is the real backlog.
    prisma.$queryRaw<Queue[]>`
      SELECT count(*)::int AS scheduled,
             (count(*) FILTER (WHERE next_check_at <= statement_timestamp() AND (lease_until IS NULL OR lease_until <= statement_timestamp())))::int AS due,
             (EXTRACT(EPOCH FROM statement_timestamp() - min(next_check_at) FILTER (WHERE next_check_at <= statement_timestamp() AND (lease_until IS NULL OR lease_until <= statement_timestamp()))) * 1000)::int AS "oldestDueMs"
      FROM monitors WHERE active AND type IN ('http','keyword','json-query','bruno','visual-diff')`,
  ])
  const now = Date.now()
  const instances = rows.map(row => {
    const metrics = (row.metrics || {}) as Record<string, any>
    const state = instanceState(row, now)
    return {
      instanceId: row.instanceId, role: row.role, startedAt: row.startedAt, lastSeen: row.lastSeen, draining: row.draining, state,
      host: metrics.host ?? null, node: metrics.node ?? null, release: metrics.release ?? null,
      inflight: state === 'running' ? row.inflight : 0, concurrency: row.concurrency,
      effectiveConcurrency: state === 'running' ? row.concurrency : 0,
      completed: metrics.completed ?? 0, failures: metrics.failures ?? 0, leaseLost: metrics.leaseLost ?? 0, maxLagMs: metrics.maxLagMs ?? 0,
      metrics: row.metrics,
    }
  })
  const running = instances.filter(row => row.state === 'running')
  const servesApi = (role: string) => role === 'api' || role === 'all'
  const runsChecks = (role: string) => role === 'worker' || role === 'all'
  const workers = running.filter(row => runsChecks(row.role))
  return {ok: true, data: {
    instanceId: workerInstanceId, role: runtimeOptions().role, ready: runtimeState.ready && !runtimeState.draining, draining: runtimeState.draining,
    local: {worker: runtimeWorker()?.status(), notifications: runtimeDispatcher()?.status(), bridge: runtimeBridge()?.metrics}, memory: process.memoryUsage(),
    outbox: {pending, dead}, supportedScheduledTypes,
    unsupported: unsupported.map(row => ({type: row.type, count: row._count.id})),
    summary: {
      api: running.filter(row => servesApi(row.role)).length,
      workers: workers.length,
      slots: workers.reduce((sum, row) => sum + row.effectiveConcurrency, 0),
      inflight: workers.reduce((sum, row) => sum + row.inflight, 0),
      stopped: instances.length - running.length,
      nodes: [...new Set(running.map(row => row.node).filter(Boolean))].length,
    },
    queue: {scheduled: queue?.scheduled ?? 0, due: queue?.due ?? 0, oldestDueMs: queue?.oldestDueMs ?? null},
    instances,
  }}
})

<script setup lang="ts">
interface RuntimeInstance {
  instanceId: string
  role: 'api' | 'worker' | 'all'
  state: 'running' | 'draining' | 'offline'
  host: string | null
  node: string | null
  release: string | null
  startedAt: string
  lastSeen: string
  inflight: number
  concurrency: number
  completed: number
  failures: number
}
interface Runtime {
  role: string
  ready: boolean
  outbox: { pending: number; dead: number }
  unsupported: { type: string; count: number }[]
  summary: { api: number; workers: number; slots: number; inflight: number; stopped: number; nodes: number }
  queue: { scheduled: number; due: number; oldestDueMs: number | null }
  instances: RuntimeInstance[]
}

const REFRESH_MS = 10000
const value = ref<Runtime>()
const message = ref('')
const loading = ref(false)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

async function refresh() {
  loading.value = true
  try {
    const response = await $fetch<{ data: Runtime }>('/api/v1/nodes/runtime')
    value.value = response.data
    now.value = Date.now()
    message.value = ''
  } catch (error: any) {
    message.value = error.statusCode === 403 ? 'Platform administrator permission required' : 'Runtime diagnostics unavailable'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()
  timer = setInterval(() => { if (!document.hidden && !loading.value) refresh() }, REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))

const running = computed(() => value.value?.instances.filter(row => row.state === 'running') || [])
const stopped = computed(() => value.value?.instances.filter(row => row.state !== 'running') || [])
const workers = computed(() => running.value.filter(row => row.role !== 'api'))
const apis = computed(() => running.value.filter(row => row.role !== 'worker'))

// "2 × 32" when every worker has the same slot count, otherwise just the total.
const slotFormula = computed(() => {
  const sizes = new Set(workers.value.map(row => row.concurrency))
  return sizes.size === 1 ? `${workers.value.length} × ${[...sizes][0]}` : ''
})

const answer = computed(() => {
  const summary = value.value?.summary
  if (!summary) return ''
  if (value.value?.role === 'all' && summary.api === 1 && summary.workers === 1) {
    return `Single-process mode: one instance serves the API and runs up to ${summary.slots} checks at the same time.`
  }
  if (!summary.workers) return 'No worker is running, so no checks are being executed. API instances never run checks themselves.'
  const apiText = summary.api === 1 ? 'the API instance' : `all ${summary.api} API instances`
  return `Workers are not tied to an API instance. All ${summary.workers} workers pull due checks from the shared PostgreSQL queue and serve ${apiText}, up to ${summary.slots} checks at the same time.`
})

function podName(row: RuntimeInstance) {
  return row.host || row.instanceId.slice(0, 8)
}

function roleLabel(role: RuntimeInstance['role']) {
  return role === 'all' ? 'API + worker' : role === 'api' ? 'API' : 'Worker'
}

function stateLabel(state: RuntimeInstance['state']) {
  return state === 'draining' ? 'Draining' : state === 'offline' ? 'Stopped' : 'Running'
}

function ago(time: string | number) {
  const seconds = Math.max(0, Math.round((now.value - new Date(time).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function duration(ms: number | null) {
  if (ms === null) return '—'
  return ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60000)} min`
}

function usage(row: RuntimeInstance) {
  return row.concurrency ? Math.min(100, Math.round((row.inflight / row.concurrency) * 100)) : 0
}
</script>

<template>
  <section class="section-card runtime" aria-labelledby="runtime-title">
    <div class="runtime-header">
      <div>
        <h3 id="runtime-title" class="runtime-title">Runtime topology</h3>
        <p class="runtime-subtitle">Live view of API and worker Pods. Refreshes every {{ REFRESH_MS / 1000 }} seconds.</p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="refresh">{{ loading ? 'Refreshing…' : 'Refresh' }}</button>
    </div>

    <p v-if="message" role="alert" class="runtime-alert">{{ message }}</p>

    <template v-if="value">
      <div class="runtime-flow" role="group" aria-label="Request and check flow">
        <div class="flow-box">
          <span class="flow-label-row"><span class="flow-label">API</span><CommonRuntimeHint kind="api" /></span>
          <strong class="flow-value">{{ value.summary.api }}</strong>
          <span class="flow-unit">{{ value.summary.api === 1 ? 'instance' : 'instances' }}</span>
          <p class="flow-note">Serve the UI, REST API and live updates. Never run checks.</p>
        </div>
        <div class="flow-arrow" aria-hidden="true">→</div>
        <div class="flow-box flow-box-queue">
          <span class="flow-label">PostgreSQL queue</span>
          <strong class="flow-value">{{ value.queue.due }}</strong>
          <span class="flow-unit">due now · {{ value.queue.scheduled }} active monitors</span>
          <p class="flow-note">Shared by every worker. Each monitor is leased to one worker at a time.</p>
        </div>
        <div class="flow-arrow" aria-hidden="true">←</div>
        <div class="flow-box">
          <span class="flow-label-row"><span class="flow-label">Workers</span><CommonRuntimeHint kind="worker" /></span>
          <strong class="flow-value">{{ value.summary.workers }}</strong>
          <span class="flow-unit">{{ value.summary.workers === 1 ? 'instance' : 'instances' }}<template v-if="slotFormula"> · {{ slotFormula }} slots</template></span>
          <p class="flow-note">{{ value.summary.inflight }} of {{ value.summary.slots }} check slots in use.</p>
        </div>
      </div>

      <p class="runtime-answer" role="status">{{ answer }}</p>

      <dl class="runtime-stats">
        <div><dt><span class="flow-label-row">Check slots in use <CommonRuntimeHint kind="slots" /></span></dt><dd>{{ value.summary.inflight }} / {{ value.summary.slots }}</dd></div>
        <div><dt>Oldest waiting check</dt><dd>{{ duration(value.queue.oldestDueMs) }}</dd></div>
        <div><dt>Kubernetes nodes</dt><dd>{{ value.summary.nodes || '—' }}</dd></div>
        <div><dt>Notification outbox</dt><dd>{{ value.outbox.pending }} pending<template v-if="value.outbox.dead"> · <span class="text-danger">{{ value.outbox.dead }} failed</span></template></dd></div>
      </dl>

      <h4 class="runtime-section-title">Workers <span class="count">{{ workers.length }}</span></h4>
      <div class="overflow-auto">
        <table class="table runtime-table">
          <thead><tr><th>Pod</th><th>Node</th><th><span class="flow-label-row">Slots in use <CommonRuntimeHint kind="slots" /></span></th><th class="num">Checks done</th><th class="num">Failures</th><th>Last seen</th></tr></thead>
          <tbody>
            <tr v-for="row in workers" :key="row.instanceId">
              <td><span class="mono" :title="row.instanceId">{{ podName(row) }}</span><span v-if="row.role === 'all'" class="role-tag">API + worker</span></td>
              <td class="mono">{{ row.node || '—' }}</td>
              <td>
                <div class="slots" :aria-label="`${row.inflight} of ${row.concurrency} slots in use`">
                  <div class="slots-bar"><div class="slots-fill" :style="{ width: usage(row) + '%' }" /></div>
                  <span>{{ row.inflight }} / {{ row.concurrency }}</span>
                </div>
              </td>
              <td class="num">{{ row.completed }}</td>
              <td class="num" :class="{ 'text-danger': row.failures }">{{ row.failures }}</td>
              <td :title="`Started ${new Date(row.startedAt).toLocaleString()}`">{{ ago(row.lastSeen) }}</td>
            </tr>
            <tr v-if="!workers.length"><td colspan="6" class="empty">No running worker.</td></tr>
          </tbody>
        </table>
      </div>

      <h4 class="runtime-section-title">API <span class="count">{{ apis.length }}</span></h4>
      <div class="overflow-auto">
        <table class="table runtime-table">
          <thead><tr><th>Pod</th><th>Node</th><th>Release</th><th>Started</th><th>Last seen</th></tr></thead>
          <tbody>
            <tr v-for="row in apis" :key="row.instanceId">
              <td><span class="mono" :title="row.instanceId">{{ podName(row) }}</span><span v-if="row.role === 'all'" class="role-tag">API + worker</span></td>
              <td class="mono">{{ row.node || '—' }}</td>
              <td class="mono">{{ row.release || '—' }}</td>
              <td :title="new Date(row.startedAt).toLocaleString()">{{ ago(row.startedAt) }}</td>
              <td :title="new Date(row.lastSeen).toLocaleString()">{{ ago(row.lastSeen) }}</td>
            </tr>
            <tr v-if="!apis.length"><td colspan="5" class="empty">No running API instance.</td></tr>
          </tbody>
        </table>
      </div>

      <details v-if="stopped.length" class="runtime-stopped">
        <summary>Stopped in the last 24 hours ({{ stopped.length }}) — old Pods from restarts and rollouts</summary>
        <div class="overflow-auto">
          <table class="table runtime-table">
            <thead><tr><th>Pod</th><th>Role</th><th>Node</th><th>State</th><th>Last seen</th></tr></thead>
            <tbody>
              <tr v-for="row in stopped" :key="row.instanceId">
                <td class="mono" :title="row.instanceId">{{ podName(row) }}</td>
                <td>{{ roleLabel(row.role) }}</td>
                <td class="mono">{{ row.node || '—' }}</td>
                <td>{{ stateLabel(row.state) }}</td>
                <td :title="new Date(row.lastSeen).toLocaleString()">{{ ago(row.lastSeen) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <p class="runtime-footnote">
        Scheduled check types: HTTP, keyword and JSON query.
        <template v-if="value.unsupported.length">
          Active monitors of other types are stored but not scheduled:
          {{ value.unsupported.map(row => `${row.type} (${row.count})`).join(', ') }}.
        </template>
      </p>
    </template>
  </section>
</template>

<style scoped>
.runtime { display: flex; flex-direction: column; gap: 1rem; }
.runtime-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.runtime-title { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); }
.runtime-subtitle { font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.15rem; }
.runtime-alert { color: var(--uk-danger); }

.runtime-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: stretch; gap: 0.5rem; }
.flow-box { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.9rem 1rem; border: 1px solid var(--border-color); border-radius: 0.6rem; background: var(--bg-tertiary); }
.flow-box-queue { border-style: dashed; }
.flow-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); }
.flow-label-row { display: inline-flex; align-items: center; gap: 0.35rem; min-height: 1.1rem; }
.flow-label-row :deep(svg) { width: 0.85rem; height: 0.85rem; }
.flow-value { font-size: 1.75rem; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.flow-unit { font-size: 0.85rem; color: var(--text-secondary); }
.flow-note { margin-top: 0.4rem; font-size: 0.8rem; color: var(--text-tertiary); }
.flow-arrow { display: flex; align-items: center; font-size: 1.25rem; color: var(--text-tertiary); }

.runtime-answer { padding: 0.75rem 1rem; border-radius: 0.5rem; background: var(--uk-primary-soft); color: var(--text-primary); font-size: 0.9rem; }

.runtime-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
.runtime-stats div { padding: 0.6rem 0.8rem; border: 1px solid var(--border-color); border-radius: 0.5rem; }
.runtime-stats dt { font-size: 0.75rem; color: var(--text-tertiary); }
.runtime-stats dd { font-size: 1rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary); }

.runtime-section-title { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; font-weight: 600; color: var(--text-primary); }
.count { font-size: 0.75rem; padding: 0 0.5rem; border-radius: 999px; background: var(--bg-tertiary); color: var(--text-secondary); }
.runtime-table { font-size: 0.875rem; }
.runtime-table td, .runtime-table th { white-space: nowrap; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
.role-tag { margin-left: 0.5rem; font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 999px; background: var(--uk-primary-soft); color: var(--uk-primary-text); }
.empty { text-align: center; color: var(--text-tertiary); }
.text-danger { color: var(--uk-danger); }

.slots { display: flex; align-items: center; gap: 0.5rem; font-variant-numeric: tabular-nums; }
.slots-bar { width: 4rem; height: 0.4rem; border-radius: 999px; background: var(--bg-tertiary); box-shadow: inset 0 0 0 1px var(--border-color); overflow: hidden; }
.slots-fill { height: 100%; background: var(--uk-primary); }

.runtime-stopped summary { cursor: pointer; font-size: 0.875rem; color: var(--text-secondary); }
.runtime-stopped .overflow-auto { margin-top: 0.5rem; }
.runtime-footnote { font-size: 0.8rem; color: var(--text-tertiary); }

@media (max-width: 900px) {
  .runtime-flow { grid-template-columns: 1fr; }
  .flow-arrow { justify-content: center; transform: rotate(90deg); }
  .runtime-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>

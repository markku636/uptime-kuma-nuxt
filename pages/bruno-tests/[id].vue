<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
import BrunoRequestEditor from '../../components/monitor/BrunoRequestEditor.vue'
import { useWorkspace } from '../../composables/useWorkspace'

const route = useRoute()
const toast = useToast()
const { environment } = useWorkspace()
const environmentId = computed(() => Number(environment.value?.id || 0) || undefined)
const id = computed(() => Number(route.params.id))
const suite = ref<any>(null)
const runs = ref<any[]>([])
const report = ref<any>(null)
const busy = ref(false)
const error = ref('')

const editingStep = ref<string | null>(null)
const expandedSteps = ref<Set<number>>(new Set())
const editingSource = ref<string | null>(null)
const sourceDrafts = ref<Record<string, string>>({})
const requestTrials = ref<Record<string, any>>({})
const requestTrialErrors = ref<Record<string, string>>({})
const requestTrialLoading = ref<string | null>(null)
function toggleDetail(index: number) {
  const next = new Set(expandedSteps.value)
  if (next.has(index)) next.delete(index); else next.add(index)
  expandedSteps.value = next
}
const drafts = ref<Record<string, Array<{ name: string; expression: string }>>>({})

function ruleToExpression(rule: any) {
  if (rule?.source === 'status') return 'res.status'
  if (rule?.source === 'responseTime') return 'res.responseTime'
  if (rule?.source === 'header') return `res.headers.${rule.path || ''}`
  if (rule?.source === 'json') return rule.path && rule.path !== '$' ? `res.body${rule.path.slice(1)}` : 'res.body'
  return ''
}

function expressionToRule(name: string, expression: string) {
  const value = expression.trim()
  if (value === 'res.status') return { name, source: 'status' }
  if (value === 'res.responseTime') return { name, source: 'responseTime' }
  const header = /^res\.headers\.([A-Za-z0-9-]{1,128})$/.exec(value)
  if (header) return { name, source: 'header', path: header[1]!.toLowerCase() }
  const body = /^res\.body(?:\.([\s\S]+))?$/.exec(value)
  if (body) return { name, source: 'json', path: '$' + (body[1] ? `.${body[1]}` : '') }
  return null
}

function initDrafts() {
  const next: Record<string, Array<{ name: string; expression: string }>> = {}
  for (const step of suite.value?.steps || []) {
    next[step.path] = (step.extract || []).map((rule: any) => ({ name: rule.name, expression: ruleToExpression(rule) }))
  }
  drafts.value = next
  sourceDrafts.value = Object.fromEntries((suite.value?.steps || []).filter((step: any) => typeof step.source === 'string').map((step: any) => [step.path, step.source]))
}

function addRule(path: string) {
  ;(drafts.value[path] ||= []).push({ name: '', expression: 'res.body.' })
}

function removeRule(path: string, index: number) {
  drafts.value[path]?.splice(index, 1)
}

function collectExtract() {
  const result: Record<string, any[]> = {}
  for (const [path, rules] of Object.entries(drafts.value)) {
    const parsed: any[] = []
    for (const rule of rules) {
      if (!rule.name.trim() && !rule.expression.trim()) continue
      const converted = expressionToRule(rule.name.trim(), rule.expression)
      if (!converted) throw new Error(`不支援的萃取表达式：${rule.expression}`)
      parsed.push(converted)
    }
    result[path] = parsed
  }
  return result
}

async function load() {
  error.value = ''
  try {
    const [detail, history] = await Promise.all([
      $fetch<any>(`/api/v1/bruno/tests/${id.value}`),
      $fetch<any>(`/api/v1/bruno/tests/${id.value}/runs`),
    ])
    suite.value = detail.data
    initDrafts()
    runs.value = history.data || []
    if (runs.value.length) await openRun(runs.value[0]!.id)
  } catch (e: any) { error.value = e.data?.message || 'Unable to load test suite' }
}

async function openRun(runId: string) {
  try {
    const result = await $fetch<any>(`/api/v1/bruno/tests/${id.value}/runs/${runId}`)
    report.value = result.data
  } catch (e: any) { error.value = e.data?.message || 'Unable to load report' }
}

async function run() {
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<any>(`/api/v1/bruno/tests/${id.value}/run`, { method: 'POST' })
    toast.add({ title: `Test ${result.data.status}`, color: result.data.status === 'pass' ? 'success' : 'error' })
    await load()
  } catch (e: any) {
    error.value = e.data?.message || 'Run failed'
  } finally { busy.value = false }
}

async function saveSource(path: string) {
  try {
    await $fetch(`/api/v1/bruno/tests/${id.value}`, { method: 'PUT', body: { stepSources: { [path]: sourceDrafts.value[path] || '' } } })
    toast.add({ title: 'Request saved', color: 'success' })
    editingSource.value = null
    await load()
  } catch (e: any) {
    error.value = e.data?.message || 'Request save failed'
  }
}

async function testRequest(step: any): Promise<void> {
  const source = sourceDrafts.value[step.path]
  if (!source || requestTrialLoading.value) return
  requestTrialLoading.value = step.path
  requestTrialErrors.value = { ...requestTrialErrors.value, [step.path]: '' }
  try {
    const result = await $fetch<{ ok: boolean; data: any }>('/api/v1/monitors/test', {
      method: 'POST',
      body: {
        name: `Trial · ${step.name}`, type: 'bruno', body: source,
        interval: 60, timeout: 30, method: 'GET', active: true,
      },
    })
    requestTrials.value = { ...requestTrials.value, [step.path]: result.data }
  } catch (e: any) {
    requestTrialErrors.value = { ...requestTrialErrors.value, [step.path]: e.data?.message || 'Request trial failed' }
  } finally {
    requestTrialLoading.value = null
  }
}

async function saveSettings() {
  try {
    const stepExtract = collectExtract()
    await $fetch(`/api/v1/bruno/tests/${id.value}`, { method: 'PUT', body: {
      name: suite.value.name, failFast: suite.value.failFast, timeoutSec: suite.value.timeoutSec,
      scheduleIntervalSec: Number(suite.value.scheduleIntervalSec || 0), stepExtract,
    } })
    toast.add({ title: 'Settings saved', color: 'success' })
  } catch (e: any) { error.value = e.data?.message || 'Save failed' }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink to="/bruno-tests" class="text-xs link">← Bruno Tests</NuxtLink>
        <h1 class="text-2xl font-semibold">{{ suite?.name || 'Bruno test' }}</h1>
        <p v-if="suite" class="text-sm text-secondary">{{ suite.collectionId }} · {{ suite.steps?.length }} steps</p>
      </div>
      <button class="btn btn-primary" :disabled="busy || !suite" @click="run">{{ busy ? 'Running…' : $t('btRunTest') }}</button>
    </div>
    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <p v-if="!suite">Loading…</p>
    <template v-else>
      <details class="card p-5">
        <summary class="cursor-pointer font-semibold">Settings (name, fail-fast, timeout)</summary>
        <div class="space-y-4 mt-4">
        <div class="grid sm:grid-cols-3 gap-4 items-end">
          <label class="text-sm">Name<input v-model="suite.name" class="input-field mt-1" /></label>
          <label class="flex items-center gap-2 text-sm"><input v-model="suite.failFast" type="checkbox" /> {{ $t('btStopFirst') }}</label>
          <label class="text-sm">Total timeout (s)<input v-model.number="suite.timeoutSec" type="number" min="30" max="180" class="input-field mt-1" /></label>
          <label class="text-sm">Schedule
            <select v-model.number="suite.scheduleIntervalSec" class="input-field mt-1">
              <option :value="0">Off (manual only)</option>
              <option :value="300">Every 5 minutes</option>
              <option :value="900">Every 15 minutes</option>
              <option :value="3600">Every hour</option>
            </select>
          </label>
        </div>
        <p v-if="suite.nextRunAt" class="text-xs text-secondary">Next scheduled run: {{ new Date(suite.nextRunAt).toLocaleString() }}</p>
        <button class="btn btn-secondary btn-sm" @click="saveSettings">{{ $t('btSaveSettings') }}</button>
        </div>
      </details>

      <section class="card p-5 overflow-x-auto">
        <h2 class="font-semibold mb-3">Steps</h2>
        <table class="table">
          <thead><tr><th>#</th><th>Name</th><th>Method</th><th>Path</th><th>Extract</th><th></th></tr></thead>
          <tbody>
            <template v-for="(step, index) in suite.steps" :key="step.path">
              <tr>
                <td>{{ Number(index) + 1 }}</td><td>{{ step.name }}</td><td>{{ step.method }}</td>
                <td class="font-mono text-xs">{{ step.path }}</td>
                <td class="text-xs">{{ step.extract.map((rule: any) => rule.name).join(', ') || '—' }}</td>
                <td class="text-right space-x-1">
                  <button v-if="typeof step.source === 'string'" class="btn btn-secondary btn-sm" @click="editingSource = editingSource === step.path ? null : step.path">{{ editingSource === step.path ? $t('btCloseRequest') : $t('btEditRequest') }}</button>
                  <button class="btn btn-secondary btn-sm" @click="editingStep = editingStep === step.path ? null : step.path">{{ editingStep === step.path ? 'Close' : 'Edit extract' }}</button>
                </td>
              </tr>
              <tr v-if="editingSource === step.path">
                <td colspan="6" class="bg-[var(--bg-secondary)]">
                  <div class="space-y-3 py-2">
                    <p class="text-xs text-secondary">使用全站共用的 Bruno request 編輯器；Scripts／Tests 不會執行，變數取自目前環境。</p>
                    <BrunoRequestEditor
                      v-model="sourceDrafts[step.path]"
                      :environment-id="environmentId"
                      :disabled="busy"
                      :trial-result="requestTrials[step.path]"
                      :trial-loading="requestTrialLoading === step.path"
                      :trial-error="requestTrialErrors[step.path] || ''"
                      @send="testRequest(step)"
                    />
                    <div class="flex flex-wrap gap-2">
                      <button class="btn btn-primary btn-sm" :disabled="busy" @click="saveSource(step.path)">{{ $t('btSaveRequest') }}</button>
                      <button class="btn btn-secondary btn-sm" @click="editingSource = null">{{ $t('btCloseRequest') }}</button>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-if="editingStep === step.path">
                <td colspan="6" class="bg-[var(--bg-secondary)]">
                  <div class="space-y-2 py-2">
                    <div v-for="(rule, ruleIndex) in (drafts[step.path] || [])" :key="ruleIndex" class="flex flex-wrap gap-2 items-center">
                      <input v-model="rule.name" class="input-field" placeholder="variable name" aria-label="Extract variable name" />
                      <input v-model="rule.expression" class="input-field flex-1" placeholder="res.body.token" aria-label="Extract expression" />
                      <button class="btn btn-danger btn-sm" @click="removeRule(step.path, ruleIndex)">Remove</button>
                    </div>
                    <p class="text-xs text-secondary">Only declarative expressions are accepted: res.status, res.responseTime, res.headers.name, res.body.path. Values are never shown in reports.</p>
                    <button class="btn btn-secondary btn-sm" @click="addRule(step.path)">Add extraction</button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>

      <section class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 class="font-semibold">{{ $t('btReports') }}</h2>
          <div v-if="report" class="flex gap-2">
            <a class="btn btn-secondary btn-sm" :href="`/api/v1/bruno/tests/${id}/runs/${report.id}/export?format=json`">{{ $t('btDownloadJson') }}</a>
            <a class="btn btn-secondary btn-sm" :href="`/api/v1/bruno/tests/${id}/runs/${report.id}/export?format=csv`">{{ $t('btDownloadCsv') }}</a>
            <a class="btn btn-secondary btn-sm" :href="`/api/v1/bruno/tests/${id}/runs/${report.id}/export?format=html`">{{ $t('btDownloadHtml') }}</a>
          </div>
        </div>
        <div v-if="!runs.length" class="text-sm text-secondary">No runs yet. Press “Run test” to generate the first report.</div>
        <div v-else class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <button v-for="run in runs" :key="run.id" class="btn btn-sm"
              :class="report?.id === run.id ? 'btn-primary' : 'btn-secondary'" @click="openRun(run.id)">
              #{{ run.id }} · {{ run.status }} · {{ new Date(run.startedAt).toLocaleString() }}
            </button>
          </div>
          <div v-if="report">
            <p class="text-sm">
              <span class="font-semibold" :class="report.status === 'pass' ? 'text-green-500' : 'text-red-400'">{{ report.status }}</span>
              · {{ report.summary.passed }} passed / {{ report.summary.failed }} failed / {{ report.summary.skipped }} skipped
              · {{ report.summary.durationMs }} ms
            </p>
            <div class="overflow-x-auto mt-3">
              <table class="table">
                <thead><tr><th>#</th><th>Name</th><th>Status</th><th>HTTP</th><th>Elapsed</th><th>Assertions</th><th>Error</th></tr></thead>
                <tbody>
                  <template v-for="step in report.steps" :key="step.stepIndex">
                    <tr>
                      <td>{{ step.stepIndex + 1 }}</td>
                      <td>{{ step.name }} <span class="text-xs text-secondary">{{ step.method }}</span></td>
                      <td>{{ step.status }}</td>
                      <td>{{ step.httpStatus ?? '—' }}</td>
                      <td>{{ step.elapsedMs }} ms</td>
                      <td class="text-xs">
                        <button v-if="step.assertions?.rules?.length" class="link" @click="toggleDetail(step.stepIndex)">
                          {{ step.assertions.rules.filter((rule: any) => rule.passed).length }} / {{ step.assertions.rules.length }} passed · {{ expandedSteps.has(step.stepIndex) ? 'hide' : 'details' }}
                        </button>
                        <template v-else>—</template>
                      </td>
                      <td class="text-xs">{{ step.errorCode || '—' }}</td>
                    </tr>
                    <tr v-if="expandedSteps.has(step.stepIndex) && step.assertions?.rules?.length">
                      <td colspan="7" class="bg-[var(--bg-secondary)]">
                        <table class="table text-xs">
                          <thead><tr><th>Rule</th><th>Source</th><th>Operator</th><th>Actual</th><th>Passed</th><th>Reason</th></tr></thead>
                          <tbody>
                            <tr v-for="rule in step.assertions.rules" :key="rule.ruleId">
                              <td class="font-mono">{{ rule.ruleId }}</td>
                              <td>{{ rule.source }}{{ rule.path ? ` ${rule.path}` : '' }}</td>
                              <td>{{ rule.operator }}</td>
                              <td class="font-mono">{{ rule.actual ?? '—' }}</td>
                              <td>{{ rule.passed ? 'yes' : 'no' }}</td>
                              <td>{{ rule.reason }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

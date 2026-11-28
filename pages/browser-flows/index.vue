<template>
  <div class="page-container">
    <div class="mb-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-primary">Browser flows</h1>
          <p class="text-secondary mt-1">Synthetic browser checks: ordered steps with visible assertions. No JavaScript is executed.</p>
        </div>
        <NuxtLink to="/dashboard" class="btn btn-secondary">Back to dashboard</NuxtLink>
      </div>
    </div>

    <div class="card card-body mb-6">
      <h2 class="section-title">New flow</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="block">
          <span class="text-sm text-toned">Name</span>
          <input v-model="name" type="text" maxlength="200" aria-label="Flow name" class="input-field mt-1" placeholder="Checkout journey" />
        </label>
        <label class="block">
          <span class="text-sm text-toned">Start URL <span class="text-tertiary">(supports {{ variableHint }} from workspace environment)</span></span>
          <input v-model="url" type="url" maxlength="8192" aria-label="Flow URL" class="input-field mt-1" placeholder="https://example.com" />
        </label>
        <label class="block">
          <span class="text-sm text-toned">Run interval</span>
          <select v-model.number="interval" class="select-field mt-1" aria-label="Flow interval">
            <option :value="60">Every minute</option>
            <option :value="300">Every 5 minutes</option>
            <option :value="900">Every 15 minutes</option>
            <option :value="3600">Every hour (recommended)</option>
          </select>
        </label>
      </div>

      <div class="mt-5 flex items-center justify-between">
        <h3 class="font-semibold text-highlighted">Steps</h3>
        <button v-if="canEdit" type="button" class="btn btn-secondary" @click="addStep">Add step</button>
      </div>
      <div class="space-y-2 mt-2">
        <div v-for="(step, index) in steps" :key="index" class="grid gap-2 md:grid-cols-[40px_170px_1fr_1fr_110px_110px] items-center">
          <span class="text-xs text-tertiary">#{{ index + 1 }}</span>
          <select v-model="step.action" class="select-field" :aria-label="`Step ${index + 1} action`">
            <option v-for="action in actions" :key="action" :value="action">{{ action }}</option>
          </select>
          <input v-model="step.selector" type="text" maxlength="512" class="input-field" :aria-label="`Step ${index + 1} selector`" :placeholder="step.action === 'goto' ? '(uses start URL)' : 'CSS selector'" :disabled="!usesSelector(step.action)" />
          <input v-model="step.value" type="text" maxlength="4096" class="input-field" :aria-label="`Step ${index + 1} value`" :placeholder="valuePlaceholder(step.action)" :disabled="!usesValue(step.action)" />
          <input v-model.number="step.timeoutMs" type="number" min="0" max="30000" class="input-field" :aria-label="`Step ${index + 1} timeout`" placeholder="default" />
          <div v-if="canEdit" class="flex items-center gap-1">
            <button type="button" class="action-btn" :aria-label="`Move step ${index + 1} up`" :disabled="index === 0" @click="moveStep(index, -1)">↑</button>
            <button type="button" class="action-btn" :aria-label="`Move step ${index + 1} down`" :disabled="index === steps.length - 1" @click="moveStep(index, 1)">↓</button>
            <button type="button" class="action-btn" :aria-label="`Remove step ${index + 1}`" @click="steps.splice(index, 1)">&times;</button>
          </div>
        </div>
      </div>
      <p class="text-xs text-tertiary mt-2">Selector、value 與 URL 可使用 workspace 環境變數／secret，例如 {{ baseUrlHint }}；值在執行時解析，不會寫入歷史或通知。</p>
      <p v-if="formError" role="alert" class="text-sm text-red-400 mt-3">{{ formError }}</p>
      <div v-if="canEdit" class="flex flex-wrap gap-2 mt-4">
        <button type="button" class="btn btn-secondary" :disabled="busy || !url" @click="testDraft">Test draft</button>
        <button type="button" class="btn btn-primary" :disabled="busy || !url || !name || !steps.length" @click="saveFlow">Save flow</button>
      </div>

      <div v-if="trial" class="mt-5 border-t border-divider pt-4">
        <div class="flex items-center gap-3 mb-2">
          <span class="badge" :class="trial.status === 1 ? 'badge-success' : 'badge-danger'">{{ trial.status === 1 ? 'PASS' : 'FAIL' }}</span>
          <span class="text-sm text-toned">{{ trial.code }} · {{ trial.ping }} ms</span>
          <span v-if="trial.detail" class="text-sm text-toned truncate" :title="trial.detail">{{ trial.detail }}</span>
        </div>
        <div v-for="step in trial.flowSteps || []" :key="step.index" class="flex flex-wrap items-center gap-2 text-sm py-1">
          <span class="text-tertiary w-10">#{{ step.index }}</span>
          <span class="font-medium">{{ step.action }}</span>
          <span class="badge" :class="step.status === 'pass' ? 'badge-success' : 'badge-danger'">{{ step.status }}</span>
          <span class="text-toned">{{ step.elapsedMs }} ms</span>
          <span v-if="step.detail" class="text-red-400">{{ step.detail }}</span>
        </div>
      </div>
    </div>

    <div class="card card-body mb-6">
      <h2 class="section-title">Import flow</h2>
      <p class="text-sm text-secondary mt-1">貼上由「Export JSON」產生的內容，載入為草稿後可再調整。</p>
      <textarea v-model="importJson" rows="5" maxlength="200000" aria-label="Flow JSON"
        placeholder='{"name":"Checkout","url":"https://example.com","body":{...}}'
        class="input-field mt-2 font-mono text-sm"></textarea>
      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" class="btn btn-secondary" :disabled="!importJson.trim()" @click="importFlow">Import as draft</button>
      </div>
    </div>

    <div class="card card-body">
      <h2 class="section-title">Saved flows ({{ flows.length }})</h2>
      <p v-if="!flows.length" class="text-secondary py-4">No browser-flow monitors yet.</p>
      <div v-for="flow in flows" :key="flow.id" class="flex flex-wrap items-center gap-3 border-b border-divider py-3 last:border-0">
        <NuxtLink :to="`/monitors/${flow.id}`" class="link font-medium">{{ flow.name }}</NuxtLink>
        <span class="badge" :class="flow.viewStatus === 'up' ? 'badge-success' : flow.viewStatus === 'down' ? 'badge-danger' : ''">{{ flow.viewStatus }}</span>
        <span class="text-xs text-tertiary">#{{ flow.id }} · {{ flow.scheduleSupported ? 'scheduled' : 'unsupported' }} · every {{ flow.interval }}s</span>
        <span v-if="lastRun(flow)" class="badge" :class="lastRun(flow)!.status === 1 ? 'badge-success' : 'badge-danger'">
          {{ lastRun(flow)!.checkCode || (lastRun(flow)!.status === 1 ? 'OK' : 'DOWN') }}
        </span>
        <span v-if="lastRun(flow)" class="text-xs text-tertiary">{{ formatRunTime(lastRun(flow)!.time) }}</span>
        <div v-if="canEdit" class="ml-auto flex flex-wrap gap-2">
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="testSaved(flow.id)">Test now</button>
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="duplicateFlow(flow)">Duplicate</button>
          <button type="button" class="btn btn-secondary" @click="exportFlow(flow)">Export JSON</button>
          <button type="button" class="btn btn-secondary" @click="removeFlow(flow.id)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWorkspace } from '../../composables/useWorkspace'
import { buildBrowserFlowPayload, BROWSER_FLOW_ACTIONS, usesValue, usesSelector } from '../../utils/browser-flow-editor'

definePageMeta({ middleware: ['auth'] })

interface FlowStep { action: string; selector: string; value: string; timeoutMs: number | null }
interface TrialResult {
  status: number
  code: string
  msg: string
  detail?: string
  ping: number
  flowSteps?: Array<{ index: number; action: string; status: string; elapsedMs: number; detail?: string }>
}
interface FlowHeartbeat { status: number; time: string; ping: number; checkCode?: string; msg?: string }
interface FlowRow {
  id: number
  name: string
  viewStatus: string
  scheduleSupported: boolean
  interval: number
  heartbeats?: FlowHeartbeat[]
}

const { canEdit } = useWorkspace()
const toast = useToast()
const variableHint = '{{' + 'variable' + '}}'
const baseUrlHint = '{{' + 'baseUrl' + '}}'
const actions = BROWSER_FLOW_ACTIONS
const name = ref('')
const url = ref('')
const interval = ref(3600)
const steps = ref<FlowStep[]>([
  { action: 'goto', selector: '', value: '', timeoutMs: null },
  { action: 'assertVisible', selector: 'h1', value: '', timeoutMs: null },
])
const busy = ref(false)
const formError = ref('')
const trial = ref<TrialResult | null>(null)
const flows = ref<FlowRow[]>([])
const importJson = ref('')

function valuePlaceholder(action: string): string {
  if (action === 'fill') return 'text to type'
  if (action === 'selectOption') return 'option value'
  if (action === 'assertText') return 'expected text'
  if (action === 'assertValue') return 'expected value'
  if (action === 'assertCount') return 'expected element count'
  if (action === 'goto') return 'optional URL override'
  if (action === 'assertUrl') return 'expected URL fragment'
  if (action === 'assertTitle') return 'expected title fragment'
  if (action === 'press') return 'key, e.g. Enter'
  if (action === 'waitForTimeout') return 'ms (0–30000)'
  return '—'
}
function addStep(): void {
  steps.value.push({ action: 'assertVisible', selector: '', value: '', timeoutMs: null })
}
function payload(): Record<string, unknown> | null {
  try {
    return buildBrowserFlowPayload({
      name: name.value, url: url.value, steps: steps.value, interval: interval.value,
    })
  } catch (error: any) {
    formError.value = error?.message || 'Invalid browser flow'
    return null
  }
}
async function runTrial(body: Record<string, unknown>): Promise<void> {
  busy.value = true
  formError.value = ''
  trial.value = null
  try {
    const result = await $fetch<{ ok: boolean; data: TrialResult }>('/api/v1/monitors/test', { method: 'POST', body })
    trial.value = result.data
  } catch (error: any) {
    formError.value = error?.data?.message || error?.message || 'Flow test failed.'
  } finally {
    busy.value = false
  }
}
function testDraft(): void {
  const body = payload()
  if (!body) return
  void runTrial(body)
}
async function saveFlow(): Promise<void> {
  const body = payload()
  if (!body) return
  busy.value = true
  formError.value = ''
  try {
    await $fetch('/api/v1/monitors', { method: 'POST', body })
    toast.add({ title: 'Browser flow saved', color: 'success' })
    await load()
  } catch (error: any) {
    formError.value = error?.data?.message || error?.message || 'Could not save flow.'
  } finally {
    busy.value = false
  }
}
async function load(): Promise<void> {
  try {
    const result = await $fetch<{ ok: boolean; data: FlowRow[] }>('/api/v1/monitors?type=browser-flow&limit=50')
    flows.value = result.data || []
  } catch { flows.value = [] }
}
async function testSaved(id: number): Promise<void> {
  try {
    const detail = await $fetch<{ ok: boolean; data: Record<string, any> }>(`/api/v1/monitors/${id}`)
    let startUrl = ''
    try { startUrl = JSON.parse(detail.data.body || '{}').startUrl || '' } catch { startUrl = '' }
    await runTrial({ ...detail.data, ...(startUrl ? { url: startUrl } : {}) } as Record<string, unknown>)
  } catch (error: any) {
    formError.value = error?.data?.message || error?.message || 'Could not load flow.'
  }
}
async function removeFlow(id: number): Promise<void> {
  try {
    await $fetch(`/api/v1/monitors/${id}`, { method: 'DELETE' })
    await load()
    toast.add({ title: 'Flow deleted', color: 'success' })
  } catch (error: any) {
    formError.value = error?.data?.message || error?.message || 'Could not delete flow.'
  }
}
function moveStep(index: number, delta: number): void {
  const target = index + delta
  if (target < 0 || target >= steps.value.length) return
  const copy = [...steps.value]
  const [moved] = copy.splice(index, 1)
  copy.splice(target, 0, moved!)
  steps.value = copy
}
function lastRun(flow: FlowRow): FlowHeartbeat | null {
  return flow.heartbeats?.[0] || null
}
function formatRunTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

async function flowDefinition(id: number): Promise<{ name: string; url: string; interval: number; body: Record<string, any> } | null> {
  const detail = await $fetch<{ ok: boolean; data: Record<string, any> }>(`/api/v1/monitors/${id}`)
  let body: Record<string, any> = {}
  try { body = JSON.parse(detail.data.body || '{}') } catch { body = {} }
  return {
    name: detail.data.name || '', url: body.startUrl || detail.data.url || '',
    interval: Number(detail.data.interval) || 3600,
    body: { ...body, startUrl: body.startUrl || detail.data.url },
  }
}

async function duplicateFlow(flow: FlowRow): Promise<void> {
  busy.value = true
  formError.value = ''
  try {
    const definition = await flowDefinition(flow.id)
    if (!definition) return
    await $fetch('/api/v1/monitors', { method: 'POST', body: {
      name: `${definition.name} (copy)`.slice(0, 200), type: 'browser-flow',
      url: definition.url, body: JSON.stringify(definition.body),
      interval: definition.interval, timeout: 30, method: 'GET', active: true,
    } })
    toast.add({ title: 'Flow duplicated', color: 'success' })
    await load()
  } catch (error: any) {
    formError.value = error?.data?.message || error?.message || 'Could not duplicate flow.'
  } finally { busy.value = false }
}

async function exportFlow(flow: FlowRow): Promise<void> {
  try {
    const definition = await flowDefinition(flow.id)
    if (!definition) return
    const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' })
    const link = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = link
    anchor.download = `browser-flow-${flow.id}.json`
    anchor.click()
    URL.revokeObjectURL(link)
  } catch (error: any) {
    formError.value = error?.data?.message || error?.message || 'Could not export flow.'
  }
}

function importFlow(): void {
  try {
    const parsed = JSON.parse(importJson.value)
    if (!parsed || typeof parsed !== 'object') throw new Error('JSON must be an object')
    const body = typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body
    if (!body || !Array.isArray(body.steps)) throw new Error('body.steps must be an array')
    name.value = String(parsed.name || '').slice(0, 200)
    url.value = String(parsed.url || body.startUrl || '').slice(0, 8192)
    const intervalValue = Number(parsed.interval)
    interval.value = [60, 300, 900, 3600].includes(intervalValue) ? intervalValue : 3600
    steps.value = body.steps.slice(0, 20).map((step: Record<string, any>) => ({
      action: String(step.action || 'assertVisible'),
      selector: String(step.selector || ''), value: String(step.value || ''),
      timeoutMs: step.timeoutMs === undefined ? null : Number(step.timeoutMs),
    }))
    formError.value = `Imported ${steps.value.length} steps as a draft. Review and save.`
  } catch (error: any) {
    formError.value = error?.message || 'Invalid flow JSON.'
  }
}

onMounted(load)
</script>

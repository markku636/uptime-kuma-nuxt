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
          <span class="text-sm text-toned">Start URL</span>
          <input v-model="url" type="url" maxlength="8192" aria-label="Flow URL" class="input-field mt-1" placeholder="https://example.com" />
        </label>
      </div>

      <div class="mt-5 flex items-center justify-between">
        <h3 class="font-semibold text-highlighted">Steps</h3>
        <button v-if="canEdit" type="button" class="btn btn-secondary" @click="addStep">Add step</button>
      </div>
      <div class="space-y-2 mt-2">
        <div v-for="(step, index) in steps" :key="index" class="grid gap-2 md:grid-cols-[40px_170px_1fr_1fr_110px_80px] items-center">
          <span class="text-xs text-tertiary">#{{ index + 1 }}</span>
          <select v-model="step.action" class="select-field" :aria-label="`Step ${index + 1} action`">
            <option v-for="action in actions" :key="action" :value="action">{{ action }}</option>
          </select>
          <input v-model="step.selector" type="text" maxlength="512" class="input-field" :aria-label="`Step ${index + 1} selector`" :placeholder="step.action === 'goto' ? '(uses start URL)' : 'CSS selector'" :disabled="step.action === 'goto'" />
          <input v-model="step.value" type="text" maxlength="4096" class="input-field" :aria-label="`Step ${index + 1} value`" :placeholder="valuePlaceholder(step.action)" :disabled="!['fill', 'assertText', 'assertValue', 'goto'].includes(step.action)" />
          <input v-model.number="step.timeoutMs" type="number" min="0" max="30000" class="input-field" :aria-label="`Step ${index + 1} timeout`" placeholder="default" />
          <button v-if="canEdit" type="button" class="action-btn" :aria-label="`Remove step ${index + 1}`" @click="steps.splice(index, 1)">&times;</button>
        </div>
      </div>
      <p v-if="formError" role="alert" class="text-sm text-red-400 mt-3">{{ formError }}</p>
      <div v-if="canEdit" class="flex flex-wrap gap-2 mt-4">
        <button type="button" class="btn btn-secondary" :disabled="busy || !url" @click="testDraft">Test draft</button>
        <button type="button" class="btn btn-primary" :disabled="busy || !url || !name || !steps.length" @click="saveFlow">Save flow</button>
      </div>

      <div v-if="trial" class="mt-5 border-t border-divider pt-4">
        <div class="flex items-center gap-3 mb-2">
          <span class="badge" :class="trial.status === 1 ? 'badge-success' : 'badge-danger'">{{ trial.status === 1 ? 'PASS' : 'FAIL' }}</span>
          <span class="text-sm text-toned">{{ trial.code }} · {{ trial.ping }} ms</span>
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

    <div class="card card-body">
      <h2 class="section-title">Saved flows ({{ flows.length }})</h2>
      <p v-if="!flows.length" class="text-secondary py-4">No browser-flow monitors yet.</p>
      <div v-for="flow in flows" :key="flow.id" class="flex flex-wrap items-center gap-3 border-b border-divider py-3 last:border-0">
        <NuxtLink :to="`/monitors/${flow.id}`" class="link font-medium">{{ flow.name }}</NuxtLink>
        <span class="badge" :class="flow.viewStatus === 'up' ? 'badge-success' : flow.viewStatus === 'down' ? 'badge-danger' : ''">{{ flow.viewStatus }}</span>
        <span class="text-xs text-tertiary">#{{ flow.id }} · {{ flow.scheduleSupported ? 'scheduled' : 'unsupported' }}</span>
        <div v-if="canEdit" class="ml-auto flex gap-2">
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="testSaved(flow.id)">Test now</button>
          <button type="button" class="btn btn-secondary" @click="removeFlow(flow.id)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWorkspace } from '../../composables/useWorkspace'

definePageMeta({ middleware: ['auth'] })

interface FlowStep { action: string; selector: string; value: string; timeoutMs: number | null }
interface TrialResult {
  status: number
  code: string
  msg: string
  ping: number
  flowSteps?: Array<{ index: number; action: string; status: string; elapsedMs: number; detail?: string }>
}
interface FlowRow { id: number; name: string; viewStatus: string; scheduleSupported: boolean }

const { canEdit } = useWorkspace()
const toast = useToast()
const actions = ['goto', 'click', 'fill', 'waitFor', 'assertVisible', 'assertText', 'assertValue'] as const
const name = ref('')
const url = ref('')
const steps = ref<FlowStep[]>([
  { action: 'goto', selector: '', value: '', timeoutMs: null },
  { action: 'assertVisible', selector: 'h1', value: '', timeoutMs: null },
])
const busy = ref(false)
const formError = ref('')
const trial = ref<TrialResult | null>(null)
const flows = ref<FlowRow[]>([])

function valuePlaceholder(action: string): string {
  return action === 'fill' ? 'text to type' : action === 'assertText' ? 'expected text' : action === 'assertValue' ? 'expected value' : action === 'goto' ? 'optional URL override' : '—'
}
function addStep(): void {
  steps.value.push({ action: 'assertVisible', selector: '', value: '', timeoutMs: null })
}
function payload() {
  const clean = steps.value
    .filter(step => step.action === 'goto' || !!step.selector.trim())
    .map(step => ({
      action: step.action,
      ...(step.action === 'goto' ? {} : { selector: step.selector.trim() }),
      ...(['fill', 'assertText', 'assertValue'].includes(step.action) ? { value: step.value } : {}),
      ...(step.timeoutMs && step.timeoutMs > 0 ? { timeoutMs: Number(step.timeoutMs) } : {}),
    }))
  return {
    name: name.value.trim(), type: 'browser-flow', url: url.value.trim(),
    body: JSON.stringify({ steps: clean, viewport: { width: 1280, height: 800 }, waitTimeoutMs: 8000, ignoreTls: false }),
    interval: 60, timeout: 30, method: 'GET', active: true,
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
  if (!url.value.trim()) return
  void runTrial(payload())
}
async function saveFlow(): Promise<void> {
  if (!name.value.trim() || !url.value.trim()) return
  busy.value = true
  formError.value = ''
  try {
    await $fetch('/api/v1/monitors', { method: 'POST', body: payload() })
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
    await runTrial(detail.data as Record<string, unknown>)
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
onMounted(load)
</script>

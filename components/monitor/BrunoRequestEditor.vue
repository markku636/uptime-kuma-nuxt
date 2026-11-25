<template>
  <div ref="root" class="bruno-editor space-y-3" @focusin="rememberFocus" @input="trackAutocomplete" @keydown.esc="autocompleteOpen = false" @keydown.ctrl.enter.prevent="$emit('send')" @keydown.meta.enter.prevent="$emit('send')">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-lg border border-[color-mix(in_srgb,currentColor_20%,transparent)] p-0.5">
          <button type="button" class="bruno-toggle" :class="mode === 'raw' ? 'bruno-toggle-active' : ''" :disabled="disabled || busy" @click="switchMode('raw')">Raw (.bru)</button>
          <button type="button" class="bruno-toggle" :class="mode === 'ui' ? 'bruno-toggle-active' : ''" :disabled="disabled || busy" @click="switchMode('ui')">UI editor</button>
        </div>
        <button type="button" class="btn btn-outline text-xs" :disabled="disabled || busy" @click="resetToSaved">Reset</button>
      </div>
      <span class="text-xs text-secondary">Bruno-style request editor · scripts, tests and post-response vars are not executed</span>
    </div>

    <p v-if="error" role="alert" class="text-sm text-red-400">{{ error }}</p>
    <!-- Raw mode -->
    <div v-if="mode === 'raw'" class="space-y-2">
      <div class="flex justify-end">
        <button type="button" class="btn btn-outline text-xs" :disabled="!rawSource" @click="copySource">{{ copied ? 'Copied' : 'Copy .bru' }}</button>
        <button type="button" class="btn btn-outline text-xs" :disabled="!rawSource" @click="downloadSource">Download .bru</button>
      </div>
      <textarea
        v-model="rawSource"
        class="input-field font-mono text-xs"
        rows="16"
        maxlength="131072"
        spellcheck="false"
        :disabled="disabled"
        placeholder="meta {&#10;  name: Example&#10;}&#10;get {&#10;  url: https://example.com/health&#10;}&#10;assert {&#10;  res.status: eq 200&#10;}"
      />
      <p v-if="urlPreview" class="text-xs text-secondary break-all">Variables: <code>{{ urlPreview.preview }}</code><span v-if="urlPreview.missing.length"> · Unknown: {{ urlPreview.missing.join(', ') }}</span></p>
    </div>

    <!-- UI mode -->
    <div v-else-if="model" class="bruno-ui space-y-3">
      <div class="grid gap-3 md:grid-cols-[120px_1fr]">
        <div>
          <label class="input-label">Method</label>
          <select v-model="model.method" class="select-field" :disabled="disabled">
            <option v-for="method in methods" :key="method" :value="method">{{ method }}</option>
          </select>
        </div>
        <div>
          <label class="input-label">URL</label>
          <input v-model="model.url" type="text" class="input-field font-mono text-xs" placeholder="https://example.com/health" :disabled="disabled">
          <p v-if="urlPreview" class="text-xs text-secondary mt-1 break-all">Resolved: <code>{{ urlPreview.preview }}</code><span v-if="urlPreview.missing.length"> · Unknown: {{ urlPreview.missing.join(', ') }}</span></p>
        </div>
        <div class="md:col-span-2">
          <label class="input-label">Request name</label>
          <input v-model="model.name" type="text" class="input-field" placeholder="Request name" :disabled="disabled">
        </div>
      </div>

      <div class="bruno-tabs" role="tablist" aria-label="Bruno request sections">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" class="bruno-tab" :class="activeTab === tab.key ? 'bruno-tab-active' : ''" :aria-selected="activeTab === tab.key" @click="activeTab = tab.key">
          {{ tab.label }} <sup v-if="counts[tab.key]" class="text-xs">{{ counts[tab.key] }}</sup>
        </button>
      </div>

      <!-- Params -->
      <section v-if="activeTab === 'params'" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-secondary">Query/path parameters · <code>&#123;&#123;variable&#125;&#125;</code> values are resolved from this environment when the check runs.</p>
          <button type="button" class="btn btn-outline text-xs" :disabled="disabled" @click="toggleBulk('params')">{{ bulkKind === 'params' ? 'Table Edit' : 'Bulk Edit' }}</button>
        </div>
        <textarea v-if="bulkKind === 'params'" v-model="bulkText" class="input-field font-mono text-xs" rows="12" spellcheck="false" placeholder="name: value" :disabled="disabled" />
        <div v-else class="overflow-x-auto"><table class="bruno-table">
          <thead><tr><th class="w-8"></th><th>Name</th><th>Value</th><th class="w-24">Type</th><th class="w-10"></th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in model.params" :key="index">
              <td><input v-model="row.enabled" type="checkbox" class="mr-2" :disabled="disabled" aria-label="Enable parameter"></td>
              <td><input v-model="row.name" type="text" class="bruno-cell" placeholder="Name" :disabled="disabled"></td>
              <td><input v-model="row.value" type="text" class="bruno-cell" placeholder="Value" :disabled="disabled"></td>
              <td>
                <select v-model="row.type" class="bruno-cell" :disabled="disabled">
                  <option value="query">query</option>
                  <option value="path">path</option>
                </select>
              </td>
              <td><button type="button" class="bruno-icon" :disabled="disabled" aria-label="Remove parameter" @click="model.params.splice(index, 1)">×</button></td>
            </tr>
          </tbody>
        </table></div>
        <button v-if="bulkKind !== 'params'" type="button" class="btn btn-outline text-xs" :disabled="disabled" @click="addRow('params')">+ Add parameter</button>
      </section>

      <!-- Body -->
      <section v-else-if="activeTab === 'body'" class="space-y-2">
        <div class="flex items-center gap-2">
          <label class="input-label mb-0">Body mode</label>
          <select v-model="model.body.mode" class="select-field w-40" :disabled="disabled">
            <option value="none">none</option>
            <option value="json">json</option>
            <option value="text">text</option>
            <option value="formUrlEncoded">form-url-encoded</option>
          </select>
        </div>
        <textarea v-if="model.body.mode !== 'none'" v-model="model.body.content" class="input-field font-mono text-xs" rows="12" spellcheck="false" :disabled="disabled" :placeholder="model.body.mode === 'json' ? '{ }' : model.body.mode === 'formUrlEncoded' ? 'name: value' : 'Body content'" />
        <p v-if="model.body.mode === 'formUrlEncoded'" class="text-xs text-secondary">One <code>name: value</code> per line; values keep <code>&#123;&#123;variable&#125;&#125;</code> placeholders.</p>
        <p v-else class="text-sm text-secondary">No request body.</p>
      </section>

      <!-- Headers -->
      <section v-else-if="activeTab === 'headers'" class="space-y-2">
        <div class="flex justify-end">
          <button type="button" class="btn btn-outline text-xs" :disabled="disabled" @click="toggleBulk('headers')">{{ bulkKind === 'headers' ? 'Table Edit' : 'Bulk Edit' }}</button>
        </div>
        <textarea v-if="bulkKind === 'headers'" v-model="bulkText" class="input-field font-mono text-xs" rows="12" spellcheck="false" placeholder="Name: value" :disabled="disabled" />
        <div v-else class="overflow-x-auto"><table class="bruno-table">
          <thead><tr><th class="w-8"></th><th>Name</th><th>Value</th><th class="w-10"></th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in model.headers" :key="index">
              <td><input v-model="row.enabled" type="checkbox" class="mr-2" :disabled="disabled" aria-label="Enable header"></td>
              <td><input v-model="row.name" type="text" class="bruno-cell" placeholder="Name" :disabled="disabled"></td>
              <td><input v-model="row.value" type="text" class="bruno-cell" placeholder="Value" :disabled="disabled"></td>
              <td><button type="button" class="bruno-icon" :disabled="disabled" aria-label="Remove header" @click="model.headers.splice(index, 1)">×</button></td>
            </tr>
          </tbody>
        </table></div>
        <button v-if="bulkKind !== 'headers'" type="button" class="btn btn-outline text-xs" :disabled="disabled" @click="addRow('headers')">+ Add header</button>
      </section>

      <!-- Auth -->
      <section v-else-if="activeTab === 'auth'" class="space-y-3">
        <div class="flex items-center gap-2">
          <label class="input-label mb-0">Auth mode</label>
          <select v-model="model.auth.mode" class="select-field w-48" aria-label="Auth mode" :disabled="disabled">
            <option value="none">none</option>
            <option value="inherit">inherit</option>
            <option value="basic">basic</option>
            <option value="bearer">bearer</option>
          </select>
        </div>
        <div v-if="model.auth.mode === 'basic'" class="grid gap-3 md:grid-cols-2">
          <div><label class="input-label">Username</label><input v-model="model.auth.username" type="text" class="input-field" :disabled="disabled"></div>
          <div><label class="input-label">Password</label><input v-model="model.auth.password" type="text" class="input-field" :disabled="disabled"></div>
        </div>
        <div v-else-if="model.auth.mode === 'bearer'">
          <label class="input-label" for="bruno-token">Token</label><input id="bruno-token" v-model="model.auth.token" type="text" class="input-field" :disabled="disabled">
        </div>
        <p v-else class="text-sm text-secondary">{{ model.auth.mode === 'inherit' ? 'Uses credentials inherited from the collection/folder.' : 'No authentication.' }}</p>
      </section>

      <!-- Vars -->
      <section v-else-if="activeTab === 'vars'" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-secondary">Pre-request variables for this request (post-response vars are not executed).</p>
          <button type="button" class="btn btn-outline text-xs" @click="envDialogOpen = true">Edit environment variables</button>
        </div>
        <div class="overflow-x-auto"><table class="bruno-table">
          <thead><tr><th class="w-8"></th><th>Name</th><th>Value</th><th class="w-10"></th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in model.vars" :key="index">
              <td><input v-model="row.enabled" type="checkbox" class="mr-2" :disabled="disabled" aria-label="Enable variable"></td>
              <td><input v-model="row.name" type="text" class="bruno-cell" placeholder="Name" :disabled="disabled"></td>
              <td><input v-model="row.value" type="text" class="bruno-cell" placeholder="Value" :disabled="disabled"></td>
              <td><button type="button" class="bruno-icon" :disabled="disabled" aria-label="Remove variable" @click="model.vars.splice(index, 1)">×</button></td>
            </tr>
          </tbody>
        </table></div>
        <button type="button" class="btn btn-outline text-xs" :disabled="disabled" @click="addRow('vars')">+ Add variable</button>
        <div v-if="environmentNames.length" class="rounded-lg border border-[color-mix(in_srgb,currentColor_15%,transparent)] p-2 space-y-1">
          <p class="text-xs text-secondary">Environment variables · focus a field, then click Insert</p>
          <div v-for="name in environmentNames" :key="name" class="flex items-center justify-between gap-2 text-xs">
            <code class="break-all">{{ variableToken(name) }}</code>
            <span class="flex items-center gap-2">
              <span class="text-secondary">{{ envSecrets.includes(name) ? '••••••' : envVariables[name] }}</span>
              <button type="button" class="btn btn-outline text-xs !px-2 !py-1" :disabled="disabled" @click="insertVariable(variableToken(name))">Insert</button>
            </span>
          </div>
        </div>
      </section>

      <!-- Script (preserved, never executed) -->
      <section v-else-if="activeTab === 'script'" class="space-y-2">
        <p class="text-xs text-amber-500">Preserved in the .bru file but never executed by the worker. Switch to Raw to edit it.</p>
        <pre v-if="ignoredBlock('script:pre-request')" class="bruno-response">{{ ignoredBlock('script:pre-request') }}</pre>
        <pre v-if="ignoredBlock('script:post-response')" class="bruno-response">{{ ignoredBlock('script:post-response') }}</pre>
        <p v-if="!ignoredBlock('script:')" class="text-sm text-secondary">No script blocks in this request.</p>
      </section>

      <!-- Assert -->
      <section v-else-if="activeTab === 'assert'" class="space-y-2">
        <div class="overflow-x-auto"><table class="bruno-table">
          <thead><tr><th class="w-8"></th><th>Expr</th><th class="w-32">Operator</th><th>Value</th><th>Description</th><th class="w-10"></th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in model.assertions" :key="index">
              <td><input v-model="row.enabled" type="checkbox" class="mr-2" :disabled="disabled" aria-label="Enable assertion"></td>
              <td><input v-model="row.expression" type="text" class="bruno-cell" placeholder="res.status" :disabled="disabled"></td>
              <td>
                <select v-model="row.operator" class="bruno-cell" :disabled="disabled" @change="row.value = isUnary(row.operator) ? '' : row.value">
                  <option v-for="operator in operators" :key="operator" :value="operator">{{ operator }}</option>
                </select>
              </td>
              <td><input v-if="!isUnary(row.operator)" v-model="row.value" type="text" class="bruno-cell" placeholder="Value" :disabled="disabled"></td>
              <td><input v-if="!isUnary(row.operator)" v-model="row.description" type="text" class="bruno-cell" placeholder="Description" :disabled="disabled"></td>
              <td><button type="button" class="bruno-icon" :disabled="disabled" aria-label="Remove assertion" @click="model.assertions.splice(index, 1)">×</button></td>
            </tr>
          </tbody>
        </table></div>
        <button type="button" class="btn btn-outline text-xs" :disabled="disabled" @click="addRow('assert')">+ Add assertion</button>
      </section>

      <!-- Tests (preserved, never executed) -->
      <section v-else-if="activeTab === 'tests'" class="space-y-2">
        <p class="text-xs text-amber-500">Preserved in the .bru file but never executed by the worker. Switch to Raw to edit it.</p>
        <pre v-if="ignoredBlock('tests')" class="bruno-response">{{ ignoredBlock('tests') }}</pre>
        <p v-else class="text-sm text-secondary">No tests block in this request.</p>
      </section>

      <!-- Docs -->
      <section v-else-if="activeTab === 'docs'" class="space-y-2">
        <p class="text-xs text-secondary">Request documentation from the <code>docs</code> block. It is kept in the .bru file and is not sent with the request.</p>
        <textarea
          :value="model.docs || ''"
          class="input-field font-mono text-xs"
          rows="14"
          spellcheck="false"
          aria-label="Docs"
          placeholder="# Endpoint&#10;Describe what this request does."
          :disabled="disabled"
          @input="model.docs = ($event.target as HTMLTextAreaElement).value"
        />
      </section>

      <!-- Settings (preserved, never executed) -->
      <section v-else-if="activeTab === 'settings'" class="space-y-2">
        <p class="text-xs text-amber-500">Request-level settings are preserved but not applied by the worker. Use the monitor form for interval and timeout.</p>
        <pre v-if="ignoredBlock('settings')" class="bruno-response">{{ ignoredBlock('settings') }}</pre>
        <p v-else class="text-sm text-secondary">No settings block in this request.</p>
      </section>

      <p v-if="model.ignoredBlocks.length" role="status" class="text-xs text-amber-500">Blocks not executed by the worker: {{ model.ignoredBlocks.join(', ') }}. They are kept verbatim in the .bru file but have no editable fields here.</p>
    </div>

    <!-- Trial / Send -->
    <div class="flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,currentColor_12%,transparent)] pt-3">
      <button type="button" class="btn btn-outline" :disabled="disabled || trialLoading || busy || !rawSource" @click="$emit('send')">{{ trialLoading ? 'Sending…' : 'Send request' }}</button>
      <span class="text-xs text-secondary">Ctrl / ⌘ + Enter</span>
      <span v-if="trialResult" class="text-sm">{{ trialResult.status === 1 ? 'Passed' : 'Failed' }} · {{ trialResult.code }} · {{ Math.round(trialResult.ping) }} ms</span>
    </div>
    <p v-if="trialError" role="alert" class="text-sm text-red-400">{{ trialError }}</p>

    <div v-if="trialResult?.assertionResults" class="section-card !p-3">
      <p class="text-sm font-medium mb-1">Assertions</p>
      <ul class="text-xs space-y-0.5">
        <li v-for="(rule, index) in trialResult.assertionResults.rules || []" :key="index" :class="rule.passed ? 'text-emerald-500' : 'text-red-400'">
          {{ rule.passed ? '✓' : '✗' }} {{ rule.source }}<template v-if="rule.path">.{{ rule.path }}</template> {{ rule.operator }} <code v-if="rule.expected !== undefined">{{ JSON.stringify(rule.expected) }}</code>
          <span v-if="rule.actual !== undefined" class="text-secondary">· actual <code>{{ typeof rule.actual === 'string' ? rule.actual : JSON.stringify(rule.actual) }}</code></span>
        </li>
      </ul>
    </div>
    <div v-if="trialResult?.response" class="section-card !p-3 space-y-2">
      <div class="flex items-center gap-3 text-sm">
        <span>Status <strong>{{ trialResult.response.status }}</strong></span>
        <span>Time <strong>{{ trialResult.response.elapsed }} ms</strong></span>
        <span v-if="trialResult.response.truncated" class="text-amber-500">(truncated)</span>
      </div>
      <div class="bruno-tabs">
        <button v-for="tab in resultTabs" :key="tab.key" type="button" class="bruno-tab" :class="resultTab === tab.key ? 'bruno-tab-active' : ''" @click="resultTab = tab.key">{{ tab.label }}</button>
      </div>
      <pre v-if="resultTab === 'headers'" class="bruno-response">{{ JSON.stringify(trialResult.response.headers, null, 2) }}</pre>
      <pre v-else-if="resultTab === 'body'" class="bruno-response">{{ prettyBody(trialResult.response.body) }}</pre>
      <p v-else class="text-sm text-secondary">No assertion details returned for this request.</p>
    </div>

    <div v-if="autocompleteOpen && autocompleteMatches.length" class="bruno-autocomplete" :style="autocompleteStyle" role="listbox">
      <button v-for="name in autocompleteMatches" :key="name" type="button" role="option" class="block w-full text-left px-2 py-1 text-xs hover:bg-elevated" @mousedown.prevent="applyAutocomplete(name)">
        <code>{{ variableToken(name) }}</code>
        <span v-if="envSecrets.includes(name)" class="ml-2 text-secondary">••••••</span>
      </button>
    </div>

    <EnvironmentVariablesDialog v-model:open="envDialogOpen" :environment-id="resolvedEnvironmentId" @insert="insertVariable" @saved="loadEnv(); emit('refreshVariables')" />
  </div>
</template>

<script setup lang="ts">
import type { BrunoRequestModel } from '../../shared/types/bruno'
import EnvironmentVariablesDialog from './EnvironmentVariablesDialog.vue'

interface Props {
  modelValue: string
  environmentId?: number
  disabled?: boolean
  trialResult?: any
  trialLoading?: boolean
  trialError?: string
}
const props = withDefaults(defineProps<Props>(), { modelValue: '', disabled: false, trialLoading: false, trialError: '' })
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'send'): void
  (event: 'refreshVariables'): void
}>()

const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const
const operators = ['eq', 'ne', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'startsWith', 'endsWith', 'length', 'between', 'matches', 'notMatches', 'contains', 'notContains', 'exists', 'notExists', 'isNull', 'isNotNull', 'isEmpty', 'isNotEmpty', 'isJson', 'isNumber', 'isString', 'isBoolean', 'isArray', 'isDefined', 'isUndefined', 'isTruthy', 'isFalsy'] as const
const unary = new Set(['exists', 'notExists', 'isNull', 'isNotNull', 'isEmpty', 'isNotEmpty', 'isJson', 'isNumber', 'isString', 'isBoolean', 'isArray', 'isDefined', 'isUndefined', 'isTruthy', 'isFalsy'])
const isUnary = (operator: string) => unary.has(operator)
const tabs = [
  { key: 'params', label: 'Params' }, { key: 'body', label: 'Body' }, { key: 'headers', label: 'Headers' },
  { key: 'auth', label: 'Auth' }, { key: 'vars', label: 'Vars' }, { key: 'script', label: 'Script' },
  { key: 'assert', label: 'Assert' }, { key: 'tests', label: 'Tests' }, { key: 'docs', label: 'Docs' },
  { key: 'settings', label: 'Settings' },
] as const
const resultTabs = [{ key: 'headers', label: 'Headers' }, { key: 'body', label: 'Body' }, { key: 'assert', label: 'Assertions' }] as const

const { current, environment } = useWorkspace()
const resolvedEnvironmentId = computed(() => Number(props.environmentId || environment.value?.id || 0) || undefined)
const savedSource = ref(props.modelValue)
const rawSource = ref(props.modelValue)
watch(() => props.modelValue, value => { if (mode.value === 'raw' && value !== rawSource.value) rawSource.value = value })
watch(rawSource, value => { if (mode.value === 'raw' && value !== props.modelValue) emit('update:modelValue', value) })

const mode = ref<'raw' | 'ui'>('ui')
const model = ref<BrunoRequestModel | null>(null)
const activeTab = ref<(typeof tabs)[number]['key']>('params')
const resultTab = ref<'headers' | 'body' | 'assert'>('body')
const busy = ref(false), error = ref(''), envDialogOpen = ref(false), copied = ref(false)
async function copySource() {
  if (!rawSource.value) return
  try { await navigator.clipboard.writeText(rawSource.value); copied.value = true; setTimeout(() => { copied.value = false }, 1500) }
  catch { error.value = 'Unable to copy; select the text and copy manually.' }
}
const bulkKind = ref<'params' | 'headers' | null>(null)
watch(activeTab, () => { bulkKind.value = null })

/** Official Bruno bulk editor: one `name: value` per line; a leading `~` marks a disabled row. */
const bulkText = computed({
  get: () => model.value && bulkKind.value
    ? model.value[bulkKind.value].map(row => `${row.enabled ? '' : '~'}${row.name}: ${row.value}`).join('\n')
    : '',
  set: text => {
    if (!model.value || !bulkKind.value) return
    const previous = model.value[bulkKind.value] as Array<{name: string; value: string; enabled: boolean; type?: 'query' | 'path'}>
    const rows = text.split(/\r?\n/).map(line => {
      const match = /^\s*(~?)\s*([^:]+?)\s*:\s?(.*)$/.exec(line)
      if (!match || !match[2]!.trim()) return null
      const name = match[2]!.trim(), old = previous.find(row => row.name === name)
      return {
        name, value: match[3] ?? '', enabled: match[1] !== '~',
        ...(bulkKind.value === 'params' && old?.type ? {type: old.type} : {}),
      }
    }).filter(row => row !== null)
    model.value[bulkKind.value] = rows as any
  },
})
function toggleBulk(kind: 'params' | 'headers') { bulkKind.value = bulkKind.value === kind ? null : kind }

function downloadSource() {
  if (!rawSource.value) return
  const url = URL.createObjectURL(new Blob([rawSource.value], {type: 'text/plain'}))
  const link = document.createElement('a')
  link.href = url
  link.download = `${(model.value?.name || 'request').replace(/[^\w.-]+/g, '_')}.bru`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function resetToSaved() {
  if (props.disabled || busy.value) return
  rawSource.value = savedSource.value
  emit('update:modelValue', savedSource.value)
  model.value = null
  error.value = ''
  await initializeUi()
}

const counts = computed(() => ({
  params: model.value?.params.filter(row => row.enabled).length || 0,
  headers: model.value?.headers.filter(row => row.enabled).length || 0,
  vars: model.value?.vars.filter(row => row.enabled).length || 0,
  assert: model.value?.assertions.filter(row => row.enabled).length || 0,
  body: model.value && model.value.body.mode !== 'none' ? 1 : 0,
  auth: model.value && model.value.auth.mode !== 'none' ? 1 : 0,
  docs: model.value?.docs?.trim() ? 1 : 0,
  script: ignoredBlock('script:') ? 1 : 0,
  tests: ignoredBlock('tests') ? 1 : 0,
  settings: ignoredBlock('settings') ? 1 : 0,
}))

const envVariables = ref<Record<string, string>>({}), envSecrets = ref<string[]>([])
async function loadEnv() {
  const workspaceId = current.value?.id
  if (!workspaceId) return
  try {
    const response = await $fetch<{ data: Array<{ id: number; variables: Record<string, string>; secretNames: string[] }> }>(`/api/v1/workspaces/${workspaceId}/environments`)
    const selected = response.data.find(item => item.id === resolvedEnvironmentId.value) || response.data[0]
    envVariables.value = selected?.variables || {}
    envSecrets.value = selected?.secretNames || []
  } catch { envVariables.value = {}; envSecrets.value = [] }
}
watch([() => current.value?.id, () => resolvedEnvironmentId.value], loadEnv, { immediate: true })

const environmentNames = computed(() => [...new Set([...Object.keys(envVariables.value), ...envSecrets.value])].sort().slice(0, 50))
const variableToken = (name: string) => `{{${name}}}`

const urlPreview = computed(() => {
  const source = mode.value === 'ui' ? model.value?.url || '' : rawSource.value
  if (!source || !/\{\{/.test(source)) return null
  return previewEnvironmentVariables(source, envVariables.value, envSecrets.value)
})

const issueMessages: Record<string, string> = {
  HTTP_BLOCK_REQUIRED: 'A single GET/POST/… request block is required.',
  DUPLICATE_HTTP_BLOCK: 'Only one HTTP method block is allowed.',
  UNSUPPORTED_BLOCK: 'This .bru block is not supported.',
  UNSUPPORTED_SYNTAX: 'The .bru syntax could not be read.',
  INVALID_SYNTAX: 'The .bru syntax is invalid.',
  MISSING_VARIABLE: 'A variable used in this request is not defined in the environment.',
  UNSUPPORTED_VARIABLE: 'A variable reference is malformed.',
  UNSUPPORTED_ASSERTION: 'An assertion uses an unsupported expression or value.',
  UNSUPPORTED_METHOD: 'This HTTP method is not supported.',
  UNSUPPORTED_AUTH: 'This authentication mode is not supported.',
  UNSUPPORTED_BODY: 'This body mode is not supported.',
  INVALID_JSON_BODY: 'The JSON body is invalid after variables are resolved.',
  AMBIGUOUS_AUTH: 'Use the Auth tab for credentials instead of an Authorization header.',
  FILE_TOO_LARGE: 'The request is too large.',
  REQUEST_COUNT: 'Exactly one request is required.',
  UNSUPPORTED_PARAMETER: 'A parameter is invalid or has no matching URL token.',
  INVALID_FIELD: 'A field has an invalid value.',
}
function issueMessage(issue: {code: string; field?: string}) {
  const text = issueMessages[issue.code] || issue.code.replace(/_/g, ' ').toLowerCase()
  return issue.field ? `${text} (${issue.field})` : text
}

async function callApi(path: string, body: Record<string, unknown>) {
  error.value = ''
  busy.value = true
  try {
    const response = await $fetch<{ data: { model?: BrunoRequestModel | null; source?: string | null; issues: Array<{ code: string; field?: string }> } }>(path, { method: 'POST', body })
    if (response.data?.issues?.length) throw new Error(response.data.issues.map(issueMessage).join(' '))
    return response.data
  } finally { busy.value = false }
}

/** Find a preserved non-executed block by its official .bru block name. */
function ignoredBlock(prefix: string) {
  return model.value?.ignoredSources?.find(source => source.trimStart().startsWith(prefix))
}

/** Query is the default param type; keep old .bru sources that omit the type usable in the select. */
function normalizeModel(value: BrunoRequestModel) {
  for (const param of value.params) if (!param.type) param.type = 'query'
  return value
}

/** Default view: parse the stored request into tabs; an empty request opens as a blank UI form. */
async function initializeUi() {
  if (!rawSource.value.trim()) {
    model.value = {
      name: 'Request', method: 'GET', url: '', params: [], headers: [],
      auth: {mode: 'none'}, body: {mode: 'none', content: ''}, vars: [], assertions: [], ignoredBlocks: [],
    }
    mode.value = 'ui'
    return
  }
  // Initialization must run even while the parent is still loading workspace permissions;
  // `disabled` only blocks user edits, not building the default UI view.
  mode.value = 'raw'
  error.value = ''
  busy.value = true
  try {
    const data = await callApi('/api/v1/bruno/request/parse', { source: rawSource.value, environmentId: resolvedEnvironmentId.value })
    if (!data.model) throw new Error('Unable to parse this .bru request')
    model.value = normalizeModel(data.model)
    mode.value = 'ui'
  } catch (failure: any) {
    error.value = failure?.data?.message || failure?.message || 'Unable to parse the request'
  } finally { busy.value = false }
}

async function switchMode(target: 'raw' | 'ui') {
  if (mode.value === target || busy.value || props.disabled) return
  try {
    if (target === 'ui') {
      const data = await callApi('/api/v1/bruno/request/parse', { source: rawSource.value, environmentId: resolvedEnvironmentId.value })
      if (!data.model) throw new Error('Unable to parse this .bru request')
      model.value = normalizeModel(data.model)
      mode.value = 'ui'
    } else {
      if (!model.value) return
      if (!model.value.url.trim()) {
        rawSource.value = `meta {\n  name: ${model.value.name || 'Request'}\n  type: http\n}\n\n${model.value.method.toLowerCase()} {\n  url: \n  body: none\n  auth: none\n}\n`
        emit('update:modelValue', rawSource.value)
        mode.value = 'raw'
        error.value = ''
        return
      }
      const data = await callApi('/api/v1/bruno/request/stringify', { model: serializableModel(), environmentId: resolvedEnvironmentId.value })
      if (!data.source) throw new Error('Unable to serialize this request')
      rawSource.value = data.source
      emit('update:modelValue', data.source)
      mode.value = 'raw'
    }
    error.value = ''
  } catch (failure: any) {
    error.value = failure?.data?.message || failure?.message || 'Unable to convert the request'
  }
}

onMounted(initializeUi)

function addRow(kind: 'params' | 'headers' | 'vars' | 'assert') {
  if (!model.value || props.disabled) return
  if (kind === 'assert') model.value.assertions.push({expression: '', operator: 'eq', value: '', enabled: true})
  else model.value[kind].push({name: '', value: '', enabled: true})
}

/** Drop rows the user added but never filled so the strict parser is not fed empty names. */
function serializableModel() {
  if (!model.value) return null
  return {
    ...model.value,
    params: model.value.params.filter(row => row.name.trim()),
    headers: model.value.headers.filter(row => row.name.trim()),
    vars: model.value.vars.filter(row => row.name.trim()),
    assertions: model.value.assertions.filter(row => row.expression.trim()),
  }
}

const root = ref<HTMLElement | null>(null)
const autocompleteOpen = ref(false), autocompleteQuery = ref(''), autocompleteTarget = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const autocompleteMatches = computed(() => environmentNames.value.filter(name => name.toLowerCase().startsWith(autocompleteQuery.value.toLowerCase())).slice(0, 8))
const autocompleteStyle = computed(() => {
  const target = autocompleteTarget.value, container = root.value
  if (!target || !container) return {}
  const box = target.getBoundingClientRect(), parent = container.getBoundingClientRect()
  return {left: `${box.left - parent.left}px`, top: `${box.bottom - parent.top + 4}px`}
})
function trackAutocomplete(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) || typeof target.value !== 'string') {
    autocompleteOpen.value = false
    return
  }
  const match = /\{\{([^{}]*)$/.exec(target.value.slice(0, target.selectionStart ?? target.value.length))
  autocompleteTarget.value = match ? target : null
  autocompleteQuery.value = match?.[1]?.trim() || ''
  autocompleteOpen.value = !!match
}
function applyAutocomplete(name: string) {
  const target = autocompleteTarget.value
  if (!target) return
  const cursor = target.selectionStart ?? target.value.length
  const before = target.value.slice(0, cursor).replace(/\{\{[^{}]*$/, `{{${name}}}`)
  target.value = before + target.value.slice(cursor)
  target.dispatchEvent(new Event('input', {bubbles: true}))
  target.focus()
  target.setSelectionRange(before.length, before.length)
  autocompleteOpen.value = false
}

let focused: HTMLElement | null = null
function rememberFocus(event: FocusEvent) {
  // Buttons must not steal the insertion target from the last editable field.
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) focused = event.target
}
function insertVariable(token: string) {
  const target = focused as HTMLInputElement | HTMLTextAreaElement | null
  if (target && typeof target.value === 'string' && 'setSelectionRange' in target) {
    const start = target.selectionStart ?? target.value.length, end = target.selectionEnd ?? start
    target.value = target.value.slice(0, start) + token + target.value.slice(end)
    target.dispatchEvent(new Event('input', { bubbles: true }))
    target.focus()
    target.setSelectionRange(start + token.length, start + token.length)
  } else rawSource.value += token
}

function prettyBody(body: string) {
  if (!body) return ''
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
}

/** Called by the parent before saving/trial so UI edits are always written back to the .bru source. */
async function sync() {
  // An incomplete request cannot be serialized by the strict parser; keep the existing source
  // so creating a monitor and filling it in later still works.
  if (mode.value === 'ui' && model.value && model.value.url.trim() && !props.disabled) {
    const data = await callApi('/api/v1/bruno/request/stringify', { model: model.value, environmentId: resolvedEnvironmentId.value })
    if (!data.source) throw new Error('Unable to serialize this request')
    rawSource.value = data.source
    emit('update:modelValue', data.source)
  }
}
defineExpose({ mode, source: rawSource, sync })
</script>

<style scoped>
.bruno-editor { position: relative; }
.bruno-toggle { padding: .3rem .75rem; font-size: .8125rem; border-radius: .5rem; color: var(--text-secondary); }
.bruno-toggle-active { background: color-mix(in srgb, var(--text-primary) 12%, transparent); color: var(--text-primary); font-weight: 600; }
.bruno-tabs { display: flex; flex-wrap: wrap; gap: .15rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
.bruno-tab { padding: .45rem .7rem; font-size: .8125rem; color: var(--text-secondary); border-bottom: 2px solid transparent; }
.bruno-tab-active { color: var(--text-primary); border-bottom-color: rgb(16 185 129); font-weight: 600; }
.bruno-table { width: 100%; border-collapse: collapse; font-size: .8125rem; }
.bruno-table th { text-align: left; padding: .35rem .5rem; color: var(--text-secondary); font-weight: 500; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
.bruno-table td { padding: .25rem .5rem; }
.bruno-cell { width: 100%; background: transparent; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: .375rem; padding: .35rem .5rem; color: var(--text-primary); font-size: .8125rem; }
.bruno-cell:focus { outline: none; border-color: rgb(16 185 129); }
.bruno-icon { color: var(--text-secondary); font-size: 1.1rem; line-height: 1; padding: 0 .35rem; }
.bruno-response { max-height: 18rem; overflow: auto; background: color-mix(in srgb, currentColor 5%, transparent); border-radius: .5rem; padding: .75rem; font-size: .75rem; white-space: pre-wrap; word-break: break-all; }
.bruno-autocomplete { position: absolute; z-index: 50; min-width: 12rem; max-height: 12rem; overflow: auto; background: var(--bg-primary, #1f2937); border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: .5rem; box-shadow: 0 8px 24px rgb(0 0 0 / 25%); }
</style>

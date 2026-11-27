<template>
  <div ref="root" class="bruno-editor space-y-3" @focusin="rememberFocus" @input="markDirty" @keydown.esc="autocompleteOpen = false" @keydown.ctrl.enter.prevent="canSend && $emit('send')" @keydown.meta.enter.prevent="canSend && $emit('send')">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-lg border border-[color-mix(in_srgb,currentColor_20%,transparent)] p-0.5">
          <button type="button" class="bruno-toggle" :class="mode === 'ui' ? 'bruno-toggle-active' : ''" :disabled="disabled || busy" @click="switchMode('ui')">UI editor</button>
          <button type="button" class="bruno-toggle" :class="mode === 'raw' ? 'bruno-toggle-active' : ''" :disabled="disabled || busy" @click="switchMode('raw')">Raw (.bru)</button>
        </div>
        <button type="button" class="btn btn-outline text-xs" :disabled="disabled || busy" @click="resetToSaved">Reset</button>
        <span v-if="dirty" role="status" class="text-xs text-amber-500">Unsaved changes</span>
        <span v-if="busy" role="status" class="text-xs text-secondary">Converting…</span>
      </div>
      <span class="text-xs text-secondary">Bruno-style request editor · scripts, tests and post-response vars are not executed</span>
    </div>

    <p v-if="error" role="alert" class="text-sm text-red-400">{{ error }}</p>
    <!-- Raw mode -->
    <div v-if="mode === 'raw'" class="space-y-2">
      <div class="flex justify-end gap-2">
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
        <p v-if="bulkWarnings.length" role="status" class="text-xs text-amber-500">{{ bulkWarnings.join(' ') }}</p>
        <textarea v-if="bulkKind === 'params'" v-model="bulkDraft" class="input-field font-mono text-xs" rows="12" spellcheck="false" placeholder="name: value" :disabled="disabled" />
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
        <p v-if="bulkWarnings.length" role="status" class="text-xs text-amber-500">{{ bulkWarnings.join(' ') }}</p>
        <textarea v-if="bulkKind === 'headers'" v-model="bulkDraft" class="input-field font-mono text-xs" rows="12" spellcheck="false" placeholder="Name: value" :disabled="disabled" />
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
        <label class="flex items-center gap-2 text-xs text-secondary">
          <input v-model="revealCredentials" type="checkbox" class="mr-1" aria-label="Show credentials" :disabled="disabled"> Show credentials
        </label>
        <div v-if="model.auth.mode === 'basic'" class="grid gap-3 md:grid-cols-2">
          <div><label class="input-label" for="bruno-username">Username</label><input id="bruno-username" v-model="model.auth.username" type="text" class="input-field" :disabled="disabled"></div>
          <div><label class="input-label" for="bruno-password">Password</label><input id="bruno-password" v-model="model.auth.password" :type="credentialInputType" class="input-field" autocomplete="off" :disabled="disabled"></div>
        </div>
        <div v-else-if="model.auth.mode === 'bearer'">
          <label class="input-label" for="bruno-token">Token</label><input id="bruno-token" v-model="model.auth.token" :type="credentialInputType" class="input-field" autocomplete="off" :disabled="disabled">
        </div>
        <p v-else class="text-sm text-secondary">{{ model.auth.mode === 'inherit' ? 'Uses credentials inherited from the collection/folder.' : 'No authentication.' }}</p>
        <p v-if="model.auth.mode === 'basic' || model.auth.mode === 'bearer'" class="text-xs text-secondary">Stored in the <code>.bru</code> request; the API never returns these values.</p>
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
          <input v-model="envFilter" type="text" class="input-field !py-1 text-xs" placeholder="Filter variables" aria-label="Filter environment variables" :disabled="disabled">
          <div v-for="name in filteredEnvironmentNames" :key="name" class="flex items-center justify-between gap-2 text-xs">
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
        <p class="text-xs text-amber-500">Preserved in the .bru file but never executed by the worker.</p>
        <textarea :value="ignoredBody('script:pre-request')" class="input-field font-mono text-xs" rows="10" spellcheck="false" aria-label="Pre-request script" placeholder="req.setHeader('X-Demo', '1');" :disabled="disabled" @input="updateIgnoredBlock('script:pre-request', $event)" />
        <textarea :value="ignoredBody('script:post-response')" class="input-field font-mono text-xs" rows="10" spellcheck="false" aria-label="Post-response script" placeholder="res.setBody({});" :disabled="disabled" @input="updateIgnoredBlock('script:post-response', $event)" />
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
              <td><input v-if="!isUnary(row.operator)" v-model="row.value" type="text" class="bruno-cell" :placeholder="valuePlaceholder(row.operator)" :disabled="disabled"></td>
              <td><input v-if="!isUnary(row.operator)" v-model="row.description" type="text" class="bruno-cell" placeholder="Description" :disabled="disabled"></td>
              <td><button type="button" class="bruno-icon" :disabled="disabled" aria-label="Remove assertion" @click="model.assertions.splice(index, 1)">×</button></td>
            </tr>
          </tbody>
        </table></div>
        <button type="button" class="btn btn-outline text-xs" :disabled="disabled" @click="addRow('assert')">+ Add assertion</button>
        <p class="text-xs text-secondary">Value format: a literal for eq / gt / lt / contains…; a JSON array for <code>in</code> and <code>notIn</code>; <code>min max</code> for <code>between</code>; a bounded regex literal for <code>matches</code> / <code>notMatches</code> (no groups, alternation or backreferences). Unary operators need no value.</p>
      </section>

      <!-- Tests (preserved, never executed) -->
      <section v-else-if="activeTab === 'tests'" class="space-y-2">
        <p class="text-xs text-amber-500">Preserved in the .bru file but never executed by the worker.</p>
        <textarea :value="ignoredBody('tests')" class="input-field font-mono text-xs" rows="12" spellcheck="false" aria-label="Tests" placeholder="test('status is 200', () => {});" :disabled="disabled" @input="updateIgnoredBlock('tests', $event)" />
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
        <textarea :value="ignoredBody('settings')" class="input-field font-mono text-xs" rows="6" spellcheck="false" aria-label="Request settings" placeholder="encodeUrl: true" :disabled="disabled" @input="updateIgnoredBlock('settings', $event)" />
      </section>

      <p v-if="model.ignoredBlocks.length" role="status" class="text-xs text-amber-500">Blocks not executed by the worker: {{ model.ignoredBlocks.join(', ') }}. They are kept verbatim in the .bru file and can be edited in their own tabs.</p>
    </div>

    <!-- Trial / Send -->
    <div class="flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,currentColor_12%,transparent)] pt-3">
      <button type="button" class="btn btn-outline" :disabled="!canSend" @click="$emit('send')">{{ trialLoading ? 'Sending…' : 'Send request' }}</button>
      <span class="text-xs text-secondary">Ctrl / ⌘ + Enter</span>
      <span v-if="mode === 'ui' && !model?.url.trim()" class="text-xs text-amber-500">Enter a URL to enable Send.</span>
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
const valuePlaceholder = (operator: string) => {
  if (operator === 'between') return '200 299'
  if (operator === 'in' || operator === 'notIn') return '[200, 201]'
  if (operator === 'matches' || operator === 'notMatches') return 'safe regex literal'
  if (['startsWith', 'endsWith', 'contains', 'notContains', 'eq', 'ne', 'neq'].includes(operator)) return 'text / number / true'
  return 'Value'
}
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
const busy = ref(false), error = ref(''), envDialogOpen = ref(false), copied = ref(false), dirty = ref(false), revealCredentials = ref(false)
const credentialInputType = computed(() => revealCredentials.value ? 'text' : 'password')
async function copySource() {
  if (!rawSource.value) return
  try { await navigator.clipboard.writeText(rawSource.value); copied.value = true; setTimeout(() => { copied.value = false }, 1500) }
  catch { error.value = 'Unable to copy; select the text and copy manually.' }
}
const bulkKind = ref<'params' | 'headers' | null>(null)
const bulkWarnings = ref<string[]>([])
const bulkDraft = ref('')
watch(activeTab, () => { bulkKind.value = null; bulkWarnings.value = [] })

/** Keep the textarea's own draft while typing so invalid lines are not normalized away before the warning is seen. */
function bulkRowsToText(kind: 'params' | 'headers') {
  return model.value?.[kind].map(row => `${row.enabled ? '' : '~'}${row.name}: ${row.value}`).join('\n') || ''
}
/** Official Bruno bulk editor: one `name: value` per line; a leading `~` marks a disabled row. */
function applyBulkDraft() {
  if (!model.value || !bulkKind.value) return
  const kind = bulkKind.value
  const previous = model.value[kind] as Array<{name: string; value: string; enabled: boolean; type?: 'query' | 'path'}>
  const rows: Array<{name: string; value: string; enabled: boolean; type?: 'query' | 'path'}> = []
  const skipped: number[] = []
  bulkDraft.value.split(/\r?\n/).forEach((line, index) => {
    const match = /^\s*(~?)\s*([^:]+?)\s*:\s?(.*)$/.exec(line)
    if (!match || !match[2]!.trim()) {
      if (line.trim()) skipped.push(index + 1)
      return
    }
    const name = match[2]!.trim(), old = previous.find(row => row.name === name)
    rows.push({
      name, value: match[3] ?? '', enabled: match[1] !== '~',
      ...(kind === 'params' && old?.type ? {type: old.type} : {}),
    })
  })
  bulkWarnings.value = skipped.length
    ? [`Skipped line${skipped.length > 1 ? 's' : ''} ${skipped.join(', ')}: use "name: value" (prefix ~ to disable).`]
    : []
  model.value[kind] = rows as any
}
watch(bulkDraft, applyBulkDraft)
function toggleBulk(kind: 'params' | 'headers') {
  bulkKind.value = bulkKind.value === kind ? null : kind
  bulkWarnings.value = []
  if (bulkKind.value) bulkDraft.value = bulkRowsToText(kind)
}

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
  dirty.value = false
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
const envFilter = ref('')
const filteredEnvironmentNames = computed(() => environmentNames.value.filter(name => name.toLowerCase().includes(envFilter.value.trim().toLowerCase())))
const variableToken = (name: string) => `{{${name}}}`

const urlPreview = computed(() => {
  const source = mode.value === 'ui' ? model.value?.url || '' : rawSource.value
  if (!source || !/\{\{/.test(source)) return null
  return previewEnvironmentVariables(source, envVariables.value, envSecrets.value)
})

/** UI edits are serialized by sync() before the parent sends, so raw source may still be empty. */
const canSend = computed(() => !props.disabled && !props.trialLoading && !busy.value
  && (mode.value === 'ui' ? !!model.value?.url.trim() : !!rawSource.value.trim()))

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
    const response = await $fetch<{ data: { model?: BrunoRequestModel | null; source?: string | null; issues: Array<{ code: string; field?: string }> } }>(path, { method: 'POST', body, signal: AbortSignal.timeout(10000) })
    if (response.data?.issues?.length) throw new Error(response.data.issues.map(issueMessage).join(' '))
    return response.data
  } finally { busy.value = false }
}

/** Find a preserved non-executed block by its official .bru block name. */
function ignoredBlock(prefix: string) {
  return model.value?.ignoredSources?.find(source => source.trimStart().startsWith(prefix))
}
function ignoredBody(name: string) {
  const block = ignoredBlock(name)
  return block ? block.replace(/^\s*\S+\s*\{/, '').replace(/\}\s*$/, '').trim() : ''
}
function updateIgnoredBlock(name: string, event: Event) {
  if (!model.value || props.disabled) return
  const body = (event.target as HTMLTextAreaElement).value
  model.value.ignoredSources ||= []
  const index = model.value.ignoredSources.findIndex(source => source.trimStart().startsWith(name))
  if (!body.trim()) {
    if (index >= 0) model.value.ignoredSources.splice(index, 1)
    const kind = name.startsWith('script:') ? 'script' : name === 'tests' ? 'tests' : name === 'vars:post-response' ? 'post-response vars' : 'settings'
    model.value.ignoredBlocks = model.value.ignoredBlocks.filter(item => item !== kind)
    return
  }
  const block = `${name} {\n${body}\n}`
  if (index >= 0) model.value.ignoredSources[index] = block
  else model.value.ignoredSources.push(block)
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
function markDirty(event: Event) {
  dirty.value = true
  trackAutocomplete(event)
}
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
    const data = await callApi('/api/v1/bruno/request/stringify', { model: serializableModel(), environmentId: resolvedEnvironmentId.value })
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

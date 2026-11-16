<script setup lang="ts">
// Import HTTP requests from Bruno: single .bru files, a whole collection
// (folder picker or drag & drop of the folder), or a collection export JSON.
// Variables are shown and editable before anything is created; a collection
// can be imported as groups that mirror its folders.
import {
  isDraftReady,
  parseBrunoInput,
  requestVariables,
  resolveRequest,
  toMonitorDraft,
  unresolvedVariables,
  variablesFor,
  type BrunoImport,
  type BrunoFile,
  type BrunoRequest,
  type MonitorDraft,
} from '~/utils/bruno'
import type { MonitorGroup } from '~/composables/useWorkspaces'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  /** workspaceId: where the kept variables were saved (the monitor must live there) */
  fill: [draft: MonitorDraft, workspaceId: number | null]
  created: [count: number]
}>()

const { t } = useI18n()
const toast = useToast()
const { workspaces, groups, defaultWorkspaceId, fetchAll, createGroup } = useWorkspaces()

const MAX_FILES = 1000
const MAX_FILE_SIZE = 2 * 1024 * 1024

const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const reading = ref(false)
const parsed = ref<BrunoImport | null>(null)
const environment = ref<string>('')
const selected = ref<Set<string>>(new Set())
const interval = ref(60)
const creating = ref(false)
const progress = ref(0)
const failures = ref<string[]>([])

// Where created monitors go
const workspaceId = ref<number | null>(null)
const createGroups = ref(true)
/** Keep {{placeholders}} in the monitors and save the values as variables */
const keepVariables = ref(false)

// ---------- Variables ----------
/** Values typed by the user; they win over every Bruno source */
const overrides = ref<Record<string, string>>({})
const revealed = ref<Set<string>>(new Set())
const showVariables = ref(false)

const storageKey = computed(() => `uk-bruno-vars:${parsed.value?.collectionName || 'files'}`)
const secretSet = computed(() => new Set(parsed.value?.secretVars ?? []))
const isSecret = (name: string) => secretSet.value.has(name) || /pass|secret|token|key/i.test(name)

// Non-secret overrides are remembered per collection; secrets never are
function loadOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey.value) || '{}')
    overrides.value = typeof saved === 'object' && saved ? saved : {}
  } catch {
    overrides.value = {}
  }
}
watch(overrides, (value) => {
  if (!parsed.value) return
  try {
    const keep = Object.fromEntries(Object.entries(value).filter(([k, v]) => v !== '' && !isSecret(k)))
    localStorage.setItem(storageKey.value, JSON.stringify(keep))
  } catch { /* storage unavailable */ }
}, { deep: true })

const envVars = computed(() => parsed.value?.environments.find(e => e.name === environment.value)?.variables)

const environmentOptions = computed(() => [
  { label: t('brunoNoEnvironment'), value: '' },
  ...(parsed.value?.environments ?? []).map(e => ({ label: e.name, value: e.name })),
])

// Monitors that already exist here: a re-import skips them by default
const existing = ref<{ name: string; url: string | null; method: string }[]>([])
async function loadExisting() {
  try {
    existing.value = (await $fetch<{ data: { name: string; url: string | null; method: string }[] }>('/api/v1/monitors?heartbeats=0')).data
  } catch {
    existing.value = []
  }
}
const existingKeys = computed(() => new Set(existing.value.map(m => `${m.method} ${m.url}`)))
const existingNames = computed(() => new Set(existing.value.map(m => m.name)))

const rows = computed(() =>
  (parsed.value?.requests ?? []).map((req) => {
    const vars = variablesFor(req, parsed.value!.collectionVars, envVars.value, overrides.value)
    const draft = toMonitorDraft(resolveRequest(req, vars))
    // With "keep variables" only request / folder constants are filled in
    // (including values typed in the dialog for those constants)
    const requestOverrides = Object.fromEntries(Object.entries(overrides.value).filter(([k, v]) => v !== '' && k in req.vars))
    const template = toMonitorDraft(resolveRequest(req, { ...req.vars, ...requestOverrides }))
    // A monitor saved with "keep variables" stores the template URL
    const exists = (existingKeys.value.has(`${draft.method} ${draft.url}`) || existingKeys.value.has(`${template.method} ${template.url}`))
      && (existingNames.value.has(req.name) || existingNames.value.has(draft.name))
    return { req, draft, template, ready: isDraftReady(draft), exists }
  }),
)

type Source = 'override' | 'request' | 'environment' | 'collection' | 'dotenv' | 'runtime' | 'missing'

/** Every variable the requests use, with its effective value and where it comes from */
const variableRows = computed(() => {
  if (!parsed.value) return []
  const used = new Map<string, BrunoRequest[]>()
  for (const req of parsed.value.requests) {
    for (const name of requestVariables(req)) {
      const list = used.get(name)
      if (list) list.push(req)
      else used.set(name, [req])
    }
  }
  return [...used.entries()].map(([name, reqs]) => {
    const req = reqs[0]
    const sources: [Source, string | undefined][] = [
      ['override', overrides.value[name] || undefined],
      ['request', req.vars[name]],
      ['environment', envVars.value?.[name] || undefined],
      [name.startsWith('process.env.') ? 'dotenv' : 'collection', parsed.value!.collectionVars[name] || undefined],
    ]
    const hit = sources.find(([, v]) => v !== undefined && v !== '')
    return {
      name,
      value: hit?.[1] ?? '',
      // Without a value: say when a script would have set it while running
      source: (hit?.[0] ?? (parsed.value!.runtimeVars.includes(name) ? 'runtime' : 'missing')) as Source,
      requests: reqs.length,
      secret: isSecret(name),
    }
  }).sort((a, b) => Number(isMissing(b.source)) - Number(isMissing(a.source)) || a.name.localeCompare(b.name))
})
const isMissing = (source: Source) => source === 'missing' || source === 'runtime'
const missingCount = computed(() => variableRows.value.filter(v => isMissing(v.source)).length)

function setOverride(name: string, value: string) {
  overrides.value = { ...overrides.value, [name]: value }
}
function toggleReveal(name: string) {
  const next = new Set(revealed.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  revealed.value = next
}

const sourceLabel = computed<Record<Source, string>>(() => ({
  override: t('brunoVarOverride'),
  request: t('brunoVarRequest'),
  environment: t('brunoEnvironment'),
  collection: t('brunoCollection'),
  dotenv: '.env',
  runtime: t('brunoVarRuntime'),
  missing: t('brunoVarMissing'),
}))

// ---------- Selection ----------
const selectedRows = computed(() => rows.value.filter(r => selected.value.has(r.req.id)))
const readySelected = computed(() => selectedRows.value.filter(r => r.ready))
const allReadySelected = computed(() => {
  const ready = rows.value.filter(r => r.ready)
  return ready.length > 0 && ready.every(r => selected.value.has(r.req.id))
})
const hasFolders = computed(() => rows.value.some(r => r.req.folder))

function reset() {
  parsed.value = null
  environment.value = ''
  selected.value = new Set()
  failures.value = []
  progress.value = 0
  overrides.value = {}
  revealed.value = new Set()
  showVariables.value = false
}

watch(open, (v) => {
  if (v) {
    workspaceId.value = defaultWorkspaceId.value
    loadExisting()
  } else if (!creating.value) reset()
})

// ---------- Reading files ----------
async function ingest(entries: { path: string; file: File }[]) {
  reading.value = true
  failures.value = []
  try {
    const files: BrunoFile[] = []
    let skipped = 0
    for (const { path, file } of entries) {
      const name = path.split('/').pop() || path
      if ((!/\.(bru|json)$/i.test(path) && name !== '.env') || /(^|\/)(node_modules|\.git)\//.test(path)) continue
      if (file.size > MAX_FILE_SIZE || files.length >= MAX_FILES) { skipped++; continue }
      files.push({ path, text: await file.text() })
    }
    const result = parseBrunoInput(files)
    if (skipped) result.errors.push(t('brunoSkippedFiles', { n: skipped }))
    parsed.value = result
    environment.value = result.environments[0]?.name ?? ''
    loadOverrides()
    showVariables.value = missingCount.value > 0
    createGroups.value = result.requests.some(r => r.folder) || !!result.collectionName
    keepVariables.value = variableRows.value.some(v => v.source !== 'request')
    // Preselect everything that can be saved as-is and is not here yet
    selected.value = new Set(rows.value.filter(r => r.ready && !r.exists).map(r => r.req.id))
    if (result.requests.length === 0) {
      toast.add({ title: t('brunoNoRequests'), color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    }
  } finally {
    reading.value = false
    if (fileInput.value) fileInput.value.value = ''
    if (folderInput.value) folderInput.value.value = ''
  }
}

function fromFileList(list: FileList | null | undefined) {
  if (!list?.length) return
  ingest(Array.from(list).map(file => ({
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    file,
  })))
}

// Dropped folders: walk them with the File System entries API, keeping paths
async function walkEntry(entry: any, prefix: string, out: { path: string; file: File }[]) {
  if (out.length > MAX_FILES) return
  if (entry.isFile) {
    const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject))
    out.push({ path: prefix + entry.name, file })
  } else if (entry.isDirectory && !['node_modules', '.git'].includes(entry.name)) {
    const reader = entry.createReader()
    // readEntries returns results in batches until it returns an empty list
    for (;;) {
      const batch: any[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
      if (!batch.length) break
      for (const child of batch) await walkEntry(child, `${prefix}${entry.name}/`, out)
    }
  }
}

async function onDrop(e: DragEvent) {
  dragging.value = false
  const items = Array.from(e.dataTransfer?.items ?? [])
  const entries = items.map(item => (item as any).webkitGetAsEntry?.()).filter(Boolean)
  if (!entries.length) return fromFileList(e.dataTransfer?.files)
  reading.value = true
  try {
    const out: { path: string; file: File }[] = []
    for (const entry of entries) await walkEntry(entry, '', out)
    await ingest(out)
  } catch {
    fromFileList(e.dataTransfer?.files)
  } finally {
    reading.value = false
  }
}

// ---------- Selection actions ----------
function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allReadySelected.value ? new Set() : new Set(rows.value.filter(r => r.ready).map(r => r.req.id))
}

// Rows that became ready (environment switched, variable filled in) get selected
watch(rows, (now, before) => {
  if (!parsed.value || !before) return
  const wasReady = new Set(before.filter(r => r.ready).map(r => r.req.id))
  const next = new Set([...selected.value].filter(id => now.find(r => r.req.id === id)?.ready))
  for (const r of now) if (r.ready && !r.exists && !wasReady.has(r.req.id)) next.add(r.req.id)
  selected.value = next
})

async function fillForm() {
  const row = selectedRows.value[0]
  if (!row) return
  if (keepVariables.value) {
    // Same as creating: the form gets the placeholders, the values become variables
    if (!(await saveKeptVariables([row]))) return
    emit('fill', row.template, workspaceId.value)
  } else {
    emit('fill', row.draft, workspaceId.value)
  }
  open.value = false
}

/** Save the variables the given rows keep as placeholders; false when that failed */
async function saveKeptVariables(targets: { template: MonitorDraft }[]): Promise<boolean> {
  const names = new Set<string>()
  for (const { template } of targets) {
    const text = [template.url, template.body, template.basicAuthUser, template.basicAuthPass, template.keyword, ...template.headers.flatMap(h => [h.key, h.value])].join('\n')
    for (const name of unresolvedVariables(text)) names.add(name)
  }
  if (!names.size) return true
  const effective = { ...(parsed.value?.collectionVars ?? {}), ...(envVars.value ?? {}), ...Object.fromEntries(Object.entries(overrides.value).filter(([, v]) => v !== '')) }
  const list = [...names].map(name => ({ name, value: effective[name] ?? '', secret: isSecret(name) }))
  try {
    await $fetch('/api/v1/variables/bulk', { method: 'POST', body: { workspaceId: workspaceId.value, variables: list } })
    return true
  } catch (e: any) {
    failures.value.push(`${t('Variables')}: ${e?.data?.message || e?.message || 'failed'}`)
    return false
  }
}

// ---------- Creating ----------
/** Find or create the group for a folder path ("" = the collection group) */
async function groupFor(folder: string, cache: Map<string, number | null>): Promise<number | null> {
  if (!createGroups.value) return null
  if (cache.has(folder)) return cache.get(folder)!
  const segments = folder ? folder.split('/') : []
  const parentPath = segments.slice(0, -1).join('/')
  const parent = folder ? await groupFor(parentPath, cache) : null
  const name = folder ? segments.at(-1)! : (parsed.value?.collectionName || 'Bruno')
  // Re-importing the same collection reuses its groups instead of duplicating them
  const existing = groups.value.find((g: MonitorGroup) =>
    g.name === name && (g.parent ?? null) === parent && (g.workspaceId ?? null) === workspaceId.value)
  const id = existing?.id ?? (await createGroup({ name, workspaceId: workspaceId.value, parent })).id
  cache.set(folder, id)
  return id
}

async function createMonitors() {
  const targets = readySelected.value
  if (targets.length === 0) return
  creating.value = true
  progress.value = 0
  failures.value = []
  let created = 0
  const groupCache = new Map<string, number | null>()

  // Every placeholder the new monitors keep, saved with the value in effect now
  if (keepVariables.value && !(await saveKeptVariables(targets))) {
    creating.value = false
    return
  }

  for (const { req, draft: resolved, template } of targets) {
    const draft = keepVariables.value ? template : resolved
    try {
      const parent = await groupFor(req.folder, groupCache)
      await $fetch('/api/v1/monitors', {
        method: 'POST',
        body: {
          type: draft.type,
          // Inside groups the folder is already visible; otherwise keep it in the name
          name: (parent ? req.name : draft.name).slice(0, 150),
          url: draft.url,
          method: draft.method,
          body: draft.body || undefined,
          headers: draft.headers.length ? Object.fromEntries(draft.headers.map(h => [h.key, h.value])) : undefined,
          authMethod: draft.authMethod || undefined,
          basicAuthUser: draft.basicAuthUser || undefined,
          basicAuthPass: draft.basicAuthPass || undefined,
          keyword: draft.keyword || undefined,
          acceptedStatuscodes: draft.acceptedStatuscodes,
          interval: Math.max(20, Number(interval.value) || 60),
          retryInterval: Math.max(20, Number(interval.value) || 60),
          active: true,
          parent,
          workspaceId: workspaceId.value,
        },
      })
      created++
    } catch (e: any) {
      failures.value.push(`${draft.name}: ${e?.data?.message || e?.message || 'failed'}`)
    }
    progress.value++
  }
  creating.value = false
  if (createGroups.value) await fetchAll()
  if (created) {
    toast.add({ title: t('brunoCreated', { n: created }), color: 'success', icon: 'i-heroicons-check-circle' })
    emit('created', created)
  }
  if (!failures.value.length) open.value = false
}

// The parser (utils/bruno.ts) is UI-free and words its warnings in English
function warningText(warning: string): string {
  let m = /^Unresolved variables: (.+)$/.exec(warning)
  if (m) return t('brunoWarnUnresolved', [m[1]])
  m = /^Auth "(.+)" is not supported/.exec(warning)
  if (m) return t('brunoWarnAuth', [m[1]])
  if (warning.startsWith('Body type is not supported')) return t('brunoWarnBody')
  if (warning.startsWith('URL must start with')) return t('brunoWarnUrl')
  return warning
}

const methodTone: Record<string, string> = {
  GET: 'text-up-fg',
  POST: 'text-pending-fg',
  PUT: 'text-maintenance-fg',
  PATCH: 'text-maintenance-fg',
  DELETE: 'text-down-fg',
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('brunoImportTitle')"
    :description="t('brunoImportDescription')"
    :dismissible="!creating"
    :ui="{ content: 'sm:max-w-3xl', footer: 'justify-between gap-2 flex-wrap' }"
  >
    <template #body>
      <!-- Pick files -->
      <div
        v-if="!parsed"
        class="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors"
        :class="dragging ? 'border-primary bg-primary/5' : 'border-accented'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <UIcon name="i-heroicons-arrow-down-tray" class="size-10 text-dimmed" />
        <p class="text-sm text-muted">{{ t('brunoDropHint') }}</p>
        <div class="flex flex-wrap justify-center gap-2">
          <UButton icon="i-heroicons-document-plus" :loading="reading" @click="fileInput?.click()">
            {{ t('brunoChooseFiles') }}
          </UButton>
          <UButton color="neutral" variant="outline" icon="i-heroicons-folder-open" :loading="reading" @click="folderInput?.click()">
            {{ t('brunoChooseFolder') }}
          </UButton>
        </div>
        <p class="text-xs text-dimmed">{{ t('brunoSupportsHint') }}</p>
        <input ref="fileInput" type="file" class="hidden" accept=".bru,.json,.env" multiple @change="fromFileList(($event.target as HTMLInputElement).files)">
        <input ref="folderInput" type="file" class="hidden" webkitdirectory multiple @change="fromFileList(($event.target as HTMLInputElement).files)">
      </div>

      <!-- Review -->
      <div v-else class="space-y-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-xs text-muted">{{ t('brunoCollection') }}</p>
            <p class="truncate font-medium text-highlighted">{{ parsed.collectionName || '—' }}</p>
          </div>
          <UFormField v-if="parsed.environments.length" :label="t('brunoEnvironment')" class="w-44">
            <USelect v-model="environment" :items="environmentOptions" class="w-full" />
          </UFormField>
          <UFormField :label="t('Heartbeat Interval')" class="w-28">
            <UInput v-model.number="interval" type="number" min="20" class="w-full">
              <template #trailing><span class="text-xs text-dimmed">s</span></template>
            </UInput>
          </UFormField>
        </div>

        <!-- Where the monitors go -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-default bg-elevated px-3 py-2 text-sm">
          <label class="flex items-center gap-2">
            <span class="text-toned">{{ t('Workspace') }}</span>
            <select v-model="workspaceId" class="select-field !w-auto py-1">
              <option :value="null">{{ t('No workspace') }}</option>
              <option v-for="w in workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
          </label>
          <label v-if="variableRows.length" class="flex items-center gap-2" :title="t('brunoKeepVariablesHint')">
            <input v-model="keepVariables" type="checkbox" class="checkbox">
            <span>{{ t('brunoKeepVariables', [workspaceId == null ? t('Global') : workspaces.find(w => w.id === workspaceId)?.name]) }}</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="createGroups" type="checkbox" class="checkbox">
            <span>{{ hasFolders ? t('brunoGroupsFromFolders') : t('brunoGroupForCollection') }}</span>
          </label>
        </div>

        <UAlert
          v-for="err in parsed.errors"
          :key="err"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :title="err"
        />

        <!-- Variables -->
        <div v-if="variableRows.length" class="overflow-hidden rounded-lg border border-default">
          <button
            type="button"
            class="flex w-full items-center gap-2 bg-elevated px-3 py-2 text-left text-sm"
            :aria-expanded="showVariables"
            @click="showVariables = !showVariables"
          >
            <UIcon name="i-heroicons-chevron-right" class="size-4 text-muted transition-transform" :class="{ 'rotate-90': showVariables }" />
            <span class="font-medium text-highlighted">{{ t('brunoVariables') }}</span>
            <span class="text-muted">{{ variableRows.length }}</span>
            <UBadge v-if="missingCount" color="warning" variant="subtle" size="sm">{{ t('brunoVarsMissing', { n: missingCount }) }}</UBadge>
          </button>
          <div v-if="showVariables" class="max-h-64 overflow-y-auto border-t border-default">
            <p class="px-3 pt-2 text-xs text-muted">{{ t('brunoVariablesHint') }}</p>
            <table class="w-full text-sm">
              <tbody>
                <tr v-for="v in variableRows" :key="v.name" class="border-b border-default last:border-0">
                  <td class="w-2/5 px-3 py-1.5 align-middle">
                    <code class="break-all text-xs text-highlighted">{{ v.name }}</code>
                    <div class="text-[11px]" :class="isMissing(v.source) ? 'text-pending-fg' : 'text-dimmed'">
                      {{ sourceLabel[v.source] }} · {{ t('brunoVarUsedBy', { n: v.requests }) }}
                    </div>
                  </td>
                  <td class="px-3 py-1.5">
                    <div class="flex items-center gap-1">
                      <input
                        :type="v.secret && !revealed.has(v.name) ? 'password' : 'text'"
                        class="input-field py-1 font-mono text-xs"
                        :class="isMissing(v.source) ? 'border-pending' : ''"
                        :value="overrides[v.name] ?? ''"
                        :placeholder="v.value || t('brunoVarEnterValue')"
                        :aria-label="v.name"
                        autocomplete="off"
                        @input="setOverride(v.name, ($event.target as HTMLInputElement).value)"
                      >
                      <UButton
                        v-if="v.secret"
                        variant="ghost"
                        color="neutral"
                        size="xs"
                        :icon="revealed.has(v.name) ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                        :aria-label="revealed.has(v.name) ? t('brunoHideValue') : t('brunoShowValue')"
                        @click="toggleReveal(v.name)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Requests -->
        <div class="overflow-hidden rounded-lg border border-default">
          <div class="flex items-center gap-3 border-b border-default bg-elevated px-3 py-2 text-sm">
            <UCheckbox :model-value="allReadySelected" :disabled="!rows.some(r => r.ready)" @update:model-value="toggleAll" />
            <span class="text-toned">{{ t('brunoSelectedCount', { n: selectedRows.length, total: rows.length }) }}</span>
          </div>
          <ul class="max-h-72 divide-y divide-(--uk-border) overflow-y-auto">
            <li
              v-for="row in rows"
              :key="row.req.id"
              class="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-hover"
              @click="toggle(row.req.id)"
            >
              <UCheckbox :model-value="selected.has(row.req.id)" class="mt-0.5" @click.stop @update:model-value="toggle(row.req.id)" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="w-14 shrink-0 font-mono text-xs font-semibold" :class="methodTone[row.draft.method] || 'text-toned'">{{ row.draft.method }}</span>
                  <span class="truncate text-sm font-medium text-highlighted">{{ row.draft.name }}</span>
                  <UBadge v-if="row.draft.type === 'keyword'" size="sm" color="neutral" variant="subtle">keyword</UBadge>
                  <UBadge v-if="row.exists" size="sm" color="info" variant="subtle">{{ t('brunoAlreadyImported') }}</UBadge>
                </div>
                <p class="truncate pl-16 font-mono text-xs text-muted">{{ row.draft.url || '—' }}</p>
                <p v-for="w in row.draft.warnings" :key="w" class="pl-16 text-xs text-pending-fg">⚠ {{ warningText(w) }}</p>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="creating" class="space-y-1">
          <UProgress :model-value="progress" :max="readySelected.length" />
          <p class="text-xs text-muted">{{ progress }} / {{ readySelected.length }}</p>
        </div>
        <UAlert
          v-if="failures.length"
          color="error"
          variant="subtle"
          icon="i-heroicons-x-circle"
          :title="t('brunoSomeFailed', { n: failures.length })"
          :description="failures.join('\n')"
          class="whitespace-pre-line"
        />
      </div>
    </template>

    <template #footer>
      <UButton v-if="parsed" color="neutral" variant="ghost" icon="i-heroicons-arrow-uturn-left" :disabled="creating" @click="reset">
        {{ t('brunoPickOther') }}
      </UButton>
      <span v-else />
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="parsed"
          color="neutral"
          variant="outline"
          :disabled="selectedRows.length !== 1 || creating"
          @click="fillForm"
        >
          {{ t('brunoFillForm') }}
        </UButton>
        <UButton
          v-if="parsed"
          icon="i-heroicons-plus"
          :loading="creating"
          :disabled="readySelected.length === 0"
          @click="createMonitors"
        >
          {{ t('brunoCreateN', { n: readySelected.length }) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

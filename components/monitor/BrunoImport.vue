<script setup lang="ts">
import type {BrunoFile} from '../../shared/types/bruno'

type Mode = 'create' | 'replace' | 'skip'
type Source = 'folder' | 'files' | 'zip' | 'paste' | 'manifest'

const route = useRoute()
const toast = useToast()
const {current, environment, canEdit, canManage} = useWorkspace()
const {flat: groupOptions, load: loadGroups} = useMonitorGroups()

const source = ref<Source>('folder')
const files = ref<BrunoFile[]>([])
const ignored = ref(0)
const pasted = ref('')
const collectionId = ref('collection')
const sourceEnvironment = ref('')
const mode = ref<Mode>('create')
const targetGroup = ref<string>(typeof route.query.targetGroup === 'string' && /^\d+$/.test(route.query.targetGroup) ? route.query.targetGroup : 'collection')
const variablesText = ref('')
const secretsText = ref('')
const busy = ref(false)
const error = ref('')
const preview = ref<any>(null)
const completed = ref<any>(null)
const previewPage = ref(0)
const exportIds = ref('')
const folderInput = ref<HTMLInputElement | null>(null)
const filesInput = ref<HTMLInputElement | null>(null)
const zipInput = ref<HTMLInputElement | null>(null)
const manifestInput = ref<HTMLInputElement | null>(null)

onMounted(() => { loadGroups().catch(() => {}) })

const sources: {value: Source; label: string; hint: string}[] = [
  {value: 'folder', label: 'Collection folder', hint: 'The folder that contains bruno.json. Sub-folders become groups.'},
  {value: 'files', label: '.bru files', hint: 'One request or several. Add environment .bru files too if the requests use them.'},
  {value: 'zip', label: 'ZIP', hint: 'A zipped collection, for example one exported from this page.'},
  {value: 'paste', label: 'Paste one request', hint: 'Paste the text of a single .bru file.'},
  {value: 'manifest', label: 'Manifest JSON', hint: 'A redacted manifest downloaded from this page.'},
]

const sourceFiles = computed<BrunoFile[]>(() => {
  if (source.value !== 'paste') return files.value
  if (!pasted.value.trim()) return []
  const name = /^\s*name:\s*(.+)$/m.exec(pasted.value)?.[1]?.trim() || 'request'
  const file = name.replace(/[^\w.-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'request'
  return [{path: `${file}.bru`, content: pasted.value.endsWith('\n') ? pasted.value : pasted.value + '\n'}]
})
const environments = computed(() => sourceFiles.value.filter(file => /^environments\/[^/]+\.bru$/.test(file.path)).map(file => file.path))
const previewRows = computed(() => preview.value?.requests.slice(previewPage.value * 100, (previewPage.value + 1) * 100) || [])
const flagged = computed(() => preview.value?.requests.filter((row: any) => row.skipped?.length).length || 0)

function clearInputs() {
  for (const input of [folderInput, filesInput, zipInput, manifestInput]) if (input.value) input.value.value = ''
}

function reset() {
  preview.value = null
  completed.value = null
  previewPage.value = 0
}

// Switching workspace/environment must never carry secrets or a preview to the new target.
watch([() => current.value?.id, () => environment.value?.id], ([workspaceId, environmentId], [oldWorkspace, oldEnvironment]) => {
  if (oldWorkspace === undefined || (workspaceId === oldWorkspace && environmentId === oldEnvironment)) return
  files.value = []
  pasted.value = ''
  variablesText.value = ''
  secretsText.value = ''
  sourceEnvironment.value = ''
  clearInputs()
  reset()
})
watch([collectionId, sourceEnvironment, mode, targetGroup, variablesText, secretsText, sourceFiles], reset, {deep: true})
watch(source, () => { files.value = []; ignored.value = 0; error.value = ''; sourceEnvironment.value = '' })

function record(text: string) {
  if (!text.trim()) return undefined
  let value: any
  try { value = JSON.parse(text) } catch { throw new Error('Variables must be a JSON object containing string values.') }
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.values(value).some(item => typeof item !== 'string')) throw new Error('Variables must be a JSON object containing string values.')
  return value as Record<string, string>
}

function manifest() {
  return {
    collectionId: collectionId.value,
    sourceEnvironment: sourceEnvironment.value || undefined,
    mode: mode.value,
    targetGroup: /^\d+$/.test(targetGroup.value) ? Number(targetGroup.value) : targetGroup.value as 'collection' | 'none',
    files: sourceFiles.value,
    variables: record(variablesText.value),
    secrets: record(secretsText.value),
  }
}

/** Suggests a stable identity from bruno.json so re-imports of the same collection match. */
function adoptCollectionName(entries: BrunoFile[]) {
  const config = entries.find(file => file.path === 'bruno.json')
  try {
    const name = config ? JSON.parse(config.content).name : ''
    const slug = typeof name === 'string' ? name.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) : ''
    if (slug && collectionId.value === 'collection') collectionId.value = slug
  } catch {}
}

/** A loose .bru that only holds vars blocks is an environment file; keep Bruno's layout for it. */
function looksLikeEnvironment(content: string) {
  return /^\s*vars(:secret)?\s*[{[]/m.test(content) && !/^\s*(get|post|put|patch|delete|head|options)\s*\{/m.test(content)
}

async function choose(event: Event) {
  error.value = ''
  reset()
  const selected = Array.from((event.target as HTMLInputElement).files || [])
  try {
    if (source.value === 'manifest') {
      const file = selected[0]
      if (!file) return
      if (file.size > 24 * 1024 * 1024) throw new Error('Manifest exceeds 24 MiB.')
      let input: any
      try { input = JSON.parse(await file.text()) } catch { throw new Error('Invalid Bruno manifest JSON.') }
      if (!Array.isArray(input.files) || input.files.some((entry: any) => typeof entry.path !== 'string' || typeof entry.content !== 'string')) throw new Error('Manifest requires files with relative paths and text content.')
      files.value = input.files
      collectionId.value = input.collectionId || 'collection'
      sourceEnvironment.value = input.sourceEnvironment || ''
      mode.value = 'create'
      ignored.value = 0
      return
    }
    if (source.value === 'zip') {
      const file = selected[0]
      if (!file) return
      const result = await readBrunoZip(file)
      files.value = result.files
      ignored.value = result.ignored
      adoptCollectionName(result.files)
      return
    }
    const accepted = selected.filter(file => file.name.endsWith('.bru') || file.name === 'bruno.json')
    ignored.value = selected.length - accepted.length
    if (accepted.length > BRUNO_LIMITS.files || accepted.reduce((sum, file) => sum + file.size, 0) > BRUNO_LIMITS.totalBytes || accepted.some(file => file.size > BRUNO_LIMITS.fileBytes)) {
      throw new Error('Limit: 4500 files, 20 MiB total, 128 KiB each.')
    }
    const root = source.value === 'folder' ? accepted[0]?.webkitRelativePath?.split('/')[0] : undefined
    const entries: BrunoFile[] = []
    for (const file of accepted) {
      const content = await file.text()
      let path = source.value === 'folder' ? file.webkitRelativePath || file.name : file.name
      if (root && path.startsWith(root + '/')) path = path.slice(root.length + 1)
      if (source.value === 'files' && path.endsWith('.bru') && looksLikeEnvironment(content)) path = `environments/${path}`
      entries.push({path, content})
    }
    files.value = entries
    sourceEnvironment.value = ''
    adoptCollectionName(entries)
  } catch (cause) {
    error.value = (cause as Error).message
    files.value = []
  }
}

async function inspect() {
  if (!canEdit.value) return
  busy.value = true
  error.value = ''
  completed.value = null
  try {
    preview.value = await $fetch('/api/v1/bruno/preview', {method: 'POST', body: manifest()})
  } catch (cause: any) {
    error.value = cause.data?.message || cause.message || 'Preview failed'
  } finally {
    busy.value = false
  }
}

async function commit() {
  if (!preview.value?.ok || !canEdit.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch('/api/v1/bruno/import', {method: 'POST', body: {...manifest(), digest: preview.value.digest}})
    preview.value = null
    secretsText.value = ''
    variablesText.value = ''
    files.value = []
    pasted.value = ''
    clearInputs()
    await nextTick()
    completed.value = result
    loadGroups().catch(() => {})
  } catch (cause: any) {
    error.value = cause.data?.message || 'Import failed'
    preview.value = null
  } finally {
    busy.value = false
  }
}

async function exportCollection() {
  busy.value = true
  error.value = ''
  try {
    const result = await downloadBruno(exportIds.value.trim() ? {ids: exportIds.value.replace(/\s+/g, '')} : {all: 1})
    const notes = [result.skipped ? `${result.skipped} monitor(s) cannot be expressed in Bruno and were left out.` : '',
      result.secretNames.length ? `Set these secrets in Bruno: ${result.secretNames.join(', ')}.` : ''].filter(Boolean)
    toast.add({title: `Downloaded ${result.name}`, description: notes.join(' ') || undefined, color: result.skipped ? 'warning' : 'success'})
  } catch (cause: any) {
    error.value = cause.message || 'Export failed'
  } finally {
    busy.value = false
  }
}

/** Every request value replaced by a placeholder, for sharing outside the workspace. */
async function downloadRedacted() {
  busy.value = true
  error.value = ''
  try {
    const response = await $fetch<any>('/api/v1/bruno/export', {query: exportIds.value ? {ids: exportIds.value} : undefined})
    const url = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], {type: 'application/json'}))
    const link = document.createElement('a')
    link.href = url
    link.download = 'bruno-manifest.json'
    link.click()
    URL.revokeObjectURL(url)
  } catch (cause: any) {
    error.value = cause.data?.data?.code || cause.data?.message || 'Export failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="section-card space-y-4">
      <div>
        <h2 class="text-xl font-semibold">Import from Bruno</h2>
        <p class="text-secondary mt-1">
          Into <strong>{{ current?.name }}</strong> / <strong>{{ environment?.name }}</strong>. Folders become groups and every request becomes a paused monitor.
          Scripts, tests and post-response variables are kept as a note on the monitor and never run.
        </p>
      </div>
      <p v-if="!canEdit" role="status">Editor access is required.</p>

      <fieldset class="source-picker" :disabled="busy || !canEdit">
        <legend class="input-label">What are you importing?</legend>
        <div class="source-options">
          <label v-for="option in sources" :key="option.value" class="source-option" :class="{active: source === option.value}">
            <input v-model="source" type="radio" name="bruno-source" :value="option.value">
            <span>{{ option.label }}</span>
          </label>
        </div>
        <p class="text-sm text-tertiary">{{ sources.find(option => option.value === source)?.hint }}</p>
      </fieldset>

      <label v-if="source === 'folder'" class="block">Collection directory<input ref="folderInput" type="file" multiple webkitdirectory class="input-field" :disabled="busy || !canEdit" @change="choose"></label>
      <label v-else-if="source === 'files'" class="block">Bruno files<input ref="filesInput" type="file" multiple accept=".bru,.json" class="input-field" :disabled="busy || !canEdit" @change="choose"></label>
      <label v-else-if="source === 'zip'" class="block">ZIP file<input ref="zipInput" type="file" accept=".zip,application/zip" class="input-field" :disabled="busy || !canEdit" @change="choose"></label>
      <label v-else-if="source === 'paste'" class="block">Request (.bru text)<textarea v-model="pasted" class="input-field font-mono" rows="10" :disabled="busy || !canEdit" spellcheck="false" placeholder="meta {&#10;  name: Health&#10;  type: http&#10;}&#10;&#10;get {&#10;  url: https://example.com/health&#10;}" /></label>
      <label v-else class="block">Exported manifest JSON<input ref="manifestInput" type="file" accept=".json" class="input-field" :disabled="busy || !canEdit" @change="choose"></label>
      <p v-if="source !== 'paste'" class="text-sm">{{ sourceFiles.length }} source files selected<span v-if="ignored">; {{ ignored }} files outside .bru/bruno.json ignored</span>.</p>

      <div class="grid-2">
        <label class="block">Place in group
          <select v-model="targetGroup" aria-label="Place in group" class="select-field" :disabled="busy">
            <option value="collection">New group named after the collection</option>
            <option value="none">No group (folders become top-level groups)</option>
            <option v-for="group in groupOptions" :key="group.id" :value="String(group.id)">{{ ' '.repeat(group.depth) }}{{ group.name }}</option>
          </select>
        </label>
        <label class="block">Collection identity<input v-model="collectionId" class="input-field" :disabled="busy || !canEdit" placeholder="stable-collection-id"></label>
      </div>
      <p class="text-sm text-tertiary">Re-importing with the same identity updates the same monitors (matched by file path), even after groups were renamed or moved.</p>

      <div class="grid-2">
        <label class="block">Source environment<select v-model="sourceEnvironment" aria-label="Source environment" class="select-field" :disabled="busy"><option value="">Use existing target environment</option><option v-for="path in environments" :key="path" :value="path">{{ path }}</option></select></label>
        <label class="block">Existing source policy<select v-model="mode" aria-label="Existing source policy" class="select-field" :disabled="busy"><option value="create">Create — reject existing identities</option><option value="skip">Skip existing identities</option><option value="replace">Replace matching identities and pause</option></select></label>
      </div>

      <details class="advanced" open>
        <summary>Variables and secrets</summary>
        <div class="space-y-3 pt-3">
          <label class="block">Static variable overrides (JSON object)<textarea v-model="variablesText" class="input-field font-mono" rows="3" :disabled="busy" placeholder='{"origin":"http://localhost:8080"}' /></label>
          <label class="block">Secret values (JSON object, write-only)<textarea v-model="secretsText" class="input-field font-mono" rows="3" :disabled="busy" autocomplete="off" spellcheck="false" placeholder='{"token":"configure locally"}' /></label>
          <p class="text-sm text-tertiary">Changing target variables/secrets requires an owner session. Existing target values can be reused by editors. Preview never sends HTTP requests or writes data.</p>
        </div>
      </details>

      <button class="btn btn-primary" :disabled="busy || !canEdit || !sourceFiles.length" @click="inspect">{{ busy ? 'Processing…' : 'Preview import' }}</button>
    </section>

    <p v-if="error" role="alert" class="error-text">{{ error }}</p>

    <section v-if="preview" class="section-card space-y-4" aria-live="polite">
      <h3 class="text-lg font-semibold">Preview</h3>
      <p>{{ preview.counts.requests }} requests · {{ preview.counts.create }} create · {{ preview.counts.replace }} replace · {{ preview.counts.skip }} skip</p>
      <p v-if="preview.missingSecrets?.length">Missing secrets: {{ preview.missingSecrets.join(', ') }}</p>
      <ul v-if="preview.issues.length" class="space-y-1 error-text"><li v-for="(issue, index) in preview.issues" :key="index">{{ issue.file || 'Manifest' }} · {{ issue.code }}<span v-if="issue.field"> · {{ issue.field }}</span></li></ul>
      <p v-if="preview.environmentChanges">Target environment values will change in the same transaction.</p>
      <div v-if="preview.groups?.length" class="group-plan">
        <p class="text-sm font-medium">Groups</p>
        <ul>
          <li v-for="plan in preview.groups" :key="plan.path" :style="{paddingLeft: `${(plan.path ? plan.path.split('/').length : 0) * 1.25}rem`}">
            <UIcon name="i-heroicons-folder" class="w-4 h-4" />
            <span>{{ plan.name }}</span>
            <span class="plan-tag" :class="plan.exists ? 'existing' : 'new'">{{ plan.exists ? 'existing' : 'new' }}</span>
          </li>
        </ul>
      </div>
      <p v-if="flagged" class="notice" role="note">{{ flagged }} request{{ flagged === 1 ? '' : 's' }} contain Bruno scripts, tests or post-response variables. They are imported and marked on the monitor but never executed — check that the monitors do not depend on them.</p>
      <div class="overflow-auto max-h-96">
        <table class="table text-sm">
          <thead><tr><th class="text-left">Path / name</th><th>Method</th><th>Assertions</th><th>Not executed</th><th>Action</th></tr></thead>
          <tbody>
            <tr v-for="row in previewRows" :key="row.path">
              <td>{{ row.path }}<br><span class="text-tertiary">{{ row.name }}</span></td>
              <td class="text-center">{{ row.method }}</td>
              <td class="text-center">{{ row.assertionCount }}</td>
              <td class="text-center">{{ row.skipped?.join(', ') || '—' }}</td>
              <td class="text-center">{{ row.action }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="preview.requests.length > 100" class="flex items-center gap-3"><button class="btn btn-outline" :disabled="previewPage === 0" @click="previewPage--">Previous</button><span>Page {{ previewPage + 1 }} / {{ Math.ceil(preview.requests.length / 100) }}</span><button class="btn btn-outline" :disabled="(previewPage + 1) * 100 >= preview.requests.length" @click="previewPage++">Next</button></div>
      <button class="btn btn-primary" :disabled="busy || !preview.ok" @click="commit">Import paused monitors</button>
    </section>

    <section v-if="completed" class="section-card space-y-3" role="status">
      <h3 class="font-semibold">Import complete — monitors paused</h3>
      <p>{{ completed.data.createdIds.length }} created · {{ completed.data.replacedIds.length }} replaced · {{ completed.data.skippedIds.length }} skipped.</p>
      <p v-if="completed.data.withSkippedBlocks" class="text-sm">{{ completed.data.withSkippedBlocks }} contain Bruno scripts or tests that are not executed.</p>
      <div class="flex gap-4"><NuxtLink to="/monitors/groups" class="link">Open groups</NuxtLink><NuxtLink to="/dashboard" class="link">Open dashboard</NuxtLink></div>
    </section>

    <section v-if="canManage" class="section-card space-y-3">
      <h3 class="font-semibold">Export to Bruno</h3>
      <p class="text-sm text-secondary">
        Downloads a ZIP you can open in Bruno: groups become folders, environment variables keep their values and secrets are listed by name only.
        Literal credentials in a request become secret variables. To export one monitor or one group, use the Groups page or the monitor page.
      </p>
      <label class="block">Monitor IDs (comma-separated; blank selects this environment)<input v-model="exportIds" class="input-field" placeholder="12,13"></label>
      <div class="flex flex-wrap gap-3">
        <button class="btn btn-primary" :disabled="busy" @click="exportCollection">Download Bruno collection (.zip)</button>
        <button class="btn btn-outline" :disabled="busy" title="Every request value replaced by a placeholder — for sharing outside this workspace" @click="downloadRedacted">Download redacted manifest</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.source-picker { border: 0; padding: 0; margin: 0; }
.source-options { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.4rem; }
.source-option { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; border: 1px solid var(--border-color); border-radius: 999px; cursor: pointer; font-size: 0.875rem; color: var(--text-secondary); }
.source-option input { accent-color: var(--uk-primary); }
.source-option.active { border-color: var(--uk-primary-text); color: var(--uk-primary-text); background: var(--uk-primary-soft); }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
.advanced summary { cursor: pointer; font-size: 0.9rem; color: var(--text-secondary); }
.group-plan ul { list-style: none; padding: 0; margin: 0.35rem 0 0; font-size: 0.875rem; }
.group-plan li { display: flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0; }
.plan-tag { font-size: 0.7rem; padding: 0 0.4rem; border-radius: 999px; }
.plan-tag.new { background: var(--uk-primary-soft); color: var(--uk-primary-text); }
.plan-tag.existing { background: var(--bg-tertiary); color: var(--text-secondary); }
.notice { padding: 0.6rem 0.8rem; border-radius: 0.5rem; background: rgba(245, 159, 11, 0.12); color: var(--text-primary); font-size: 0.875rem; }
.error-text { color: var(--uk-danger); }
</style>

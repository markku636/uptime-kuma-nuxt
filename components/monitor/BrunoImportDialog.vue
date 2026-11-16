<script setup lang="ts">
// Import HTTP requests from Bruno (.bru files, a collection folder, or a
// collection export JSON). One request can prefill the monitor form; several
// can be created as monitors directly.
import {
  isDraftReady,
  parseBrunoInput,
  resolveRequest,
  toMonitorDraft,
  type BrunoImport,
  type BrunoFile,
  type MonitorDraft,
} from '~/utils/bruno'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  fill: [draft: MonitorDraft]
  created: [count: number]
}>()

const { t } = useI18n()
const toast = useToast()

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

const environmentOptions = computed(() => [
  { label: t('brunoNoEnvironment'), value: '' },
  ...(parsed.value?.environments ?? []).map(e => ({ label: e.name, value: e.name })),
])

const variables = computed<Record<string, string>>(() => {
  const env = parsed.value?.environments.find(e => e.name === environment.value)
  return { ...(parsed.value?.collectionVars ?? {}), ...(env?.variables ?? {}) }
})

const rows = computed(() =>
  (parsed.value?.requests ?? []).map((req) => {
    const draft = toMonitorDraft(resolveRequest(req, variables.value))
    return { req, draft, ready: isDraftReady(draft) }
  }),
)

const selectedRows = computed(() => rows.value.filter(r => selected.value.has(r.req.id)))
const readySelected = computed(() => selectedRows.value.filter(r => r.ready))
const allReadySelected = computed(() => {
  const ready = rows.value.filter(r => r.ready)
  return ready.length > 0 && ready.every(r => selected.value.has(r.req.id))
})

function reset() {
  parsed.value = null
  environment.value = ''
  selected.value = new Set()
  failures.value = []
  progress.value = 0
}

watch(open, (v) => { if (!v && !creating.value) reset() })

async function readFiles(list: FileList | File[] | null | undefined) {
  if (!list || list.length === 0) return
  reading.value = true
  failures.value = []
  try {
    const files: BrunoFile[] = []
    let skipped = 0
    for (const file of Array.from(list)) {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      if (!/\.(bru|json)$/i.test(path) || /(^|\/)(node_modules|\.git)\//.test(path)) continue
      if (file.size > MAX_FILE_SIZE || files.length >= MAX_FILES) { skipped++; continue }
      files.push({ path, text: await file.text() })
    }
    const result = parseBrunoInput(files)
    if (skipped) result.errors.push(t('brunoSkippedFiles', { n: skipped }))
    parsed.value = result
    environment.value = result.environments[0]?.name ?? ''
    // Preselect everything that can be saved as-is
    selected.value = new Set(rows.value.filter(r => r.ready).map(r => r.req.id))
    if (result.requests.length === 0) {
      toast.add({ title: t('brunoNoRequests'), color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    }
  } finally {
    reading.value = false
    if (fileInput.value) fileInput.value.value = ''
    if (folderInput.value) folderInput.value.value = ''
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  readFiles(e.dataTransfer?.files)
}

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allReadySelected.value ? new Set() : new Set(rows.value.filter(r => r.ready).map(r => r.req.id))
}

// Re-select after switching environment: rows that became ready are added
watch(environment, () => {
  if (!parsed.value) return
  const next = new Set([...selected.value].filter(id => rows.value.find(r => r.req.id === id)?.ready))
  for (const r of rows.value) if (r.ready) next.add(r.req.id)
  selected.value = next
})

function fillForm() {
  const row = selectedRows.value[0]
  if (!row) return
  emit('fill', row.draft)
  open.value = false
}

async function createMonitors() {
  const targets = readySelected.value
  if (targets.length === 0) return
  creating.value = true
  progress.value = 0
  failures.value = []
  let created = 0
  for (const { draft } of targets) {
    try {
      await $fetch('/api/v1/monitors', {
        method: 'POST',
        body: {
          type: draft.type,
          name: draft.name.slice(0, 150),
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
        },
      })
      created++
    } catch (e: any) {
      failures.value.push(`${draft.name}: ${e?.data?.message || e?.message || 'failed'}`)
    }
    progress.value++
  }
  creating.value = false
  if (created) {
    toast.add({ title: t('brunoCreated', { n: created }), color: 'success', icon: 'i-heroicons-check-circle' })
    emit('created', created)
  }
  if (!failures.value.length) open.value = false
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
        <input ref="fileInput" type="file" class="hidden" accept=".bru,.json" multiple @change="readFiles(($event.target as HTMLInputElement).files)">
        <input ref="folderInput" type="file" class="hidden" webkitdirectory multiple @change="readFiles(($event.target as HTMLInputElement).files)">
      </div>

      <!-- Review -->
      <div v-else class="space-y-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-xs text-muted">{{ t('brunoCollection') }}</p>
            <p class="truncate font-medium text-highlighted">{{ parsed.collectionName || '—' }}</p>
          </div>
          <UFormField v-if="parsed.environments.length" :label="t('brunoEnvironment')" class="w-48">
            <USelect v-model="environment" :items="environmentOptions" class="w-full" />
          </UFormField>
          <UFormField :label="t('Heartbeat Interval')" class="w-32">
            <UInput v-model.number="interval" type="number" min="20" class="w-full">
              <template #trailing><span class="text-xs text-dimmed">s</span></template>
            </UInput>
          </UFormField>
        </div>

        <UAlert
          v-for="err in parsed.errors"
          :key="err"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :title="err"
        />

        <div class="overflow-hidden rounded-lg border border-default">
          <div class="flex items-center gap-3 border-b border-default bg-elevated px-3 py-2 text-sm">
            <UCheckbox :model-value="allReadySelected" :disabled="!rows.some(r => r.ready)" @update:model-value="toggleAll" />
            <span class="text-toned">{{ t('brunoSelectedCount', { n: selectedRows.length, total: rows.length }) }}</span>
          </div>
          <ul class="max-h-80 divide-y divide-(--uk-border) overflow-y-auto">
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
                </div>
                <p class="truncate pl-16 font-mono text-xs text-muted">{{ row.draft.url || '—' }}</p>
                <p v-for="w in row.draft.warnings" :key="w" class="pl-16 text-xs text-pending-fg">⚠ {{ w }}</p>
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

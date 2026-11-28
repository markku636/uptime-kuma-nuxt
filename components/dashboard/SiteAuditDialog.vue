<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    role="dialog" aria-modal="true" aria-label="Website audit" @click.self="close">
    <div class="card w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
      <div class="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">Website audit</h2>
          <p class="text-sm text-toned mt-1">One-shot checks: HTTP, TLS, DNS, security headers, metadata and local links.</p>
        </div>
        <button type="button" class="text-toned hover:text-highlighted text-xl leading-none" aria-label="Close" @click="close">&times;</button>
      </div>

      <form class="space-y-3" @submit.prevent="run">
        <label class="block">
          <span class="text-sm text-toned">Website URL</span>
          <input v-model="url" type="url" inputmode="url" required maxlength="8192" autofocus
            placeholder="https://example.com" aria-label="Audit URL" class="input-field mt-1" />
        </label>
        <label class="block">
          <span class="text-sm text-toned">Expected keyword <span class="text-tertiary">(optional)</span></span>
          <input v-model="keyword" type="text" maxlength="200" aria-label="Expected keyword"
            placeholder="Welcome" class="input-field mt-1" />
        </label>
        <p v-if="error" role="alert" class="text-sm text-red-400">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secondary" @click="close">Close</button>
          <button type="submit" class="btn btn-primary" :disabled="busy || !url">
            {{ busy ? 'Auditing…' : 'Run audit' }}
          </button>
        </div>
      </form>

      <div v-if="report" class="mt-6 border-t border-divider pt-5">
        <div class="flex flex-wrap items-center gap-4 mb-4">
          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-bold" :class="scoreColor">{{ report.score }}</span>
            <span class="text-sm text-toned">/ 100</span>
          </div>
          <span class="badge text-base px-3 py-1" :class="scoreColor">{{ report.grade }}</span>
          <div class="text-sm text-toned">
            <div class="truncate max-w-md" :title="report.finalUrl">{{ report.finalUrl }}</div>
            <div>{{ report.durationMs }} ms · {{ formatTime(report.checkedAt) }}</div>
          </div>
        </div>
        <div class="space-y-2">
          <div v-for="check in report.checks" :key="check.id" class="card card-body !p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium text-highlighted">{{ check.label }}</span>
              <span class="badge" :class="badgeClass(check.status)">{{ statusLabel(check.status) }}</span>
            </div>
            <p class="text-sm text-toned mt-1">{{ check.summary }}</p>
            <ul v-if="check.detail?.length" class="mt-1 space-y-0.5 text-xs text-tertiary">
              <li v-for="(line, index) in check.detail" :key="index" class="truncate" :title="line">· {{ line }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

interface AuditCheckView { id: string; label: string; status: string; summary: string; detail?: string[] }
interface AuditReportView {
  url: string
  finalUrl: string
  checkedAt: string
  durationMs: number
  score: number
  grade: string
  checks: AuditCheckView[]
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (event: 'close'): void }>()

const url = ref('')
const keyword = ref('')
const busy = ref(false)
const error = ref('')
const report = ref<AuditReportView | null>(null)

watch(() => props.open, value => {
  if (!value) return
  url.value = ''
  keyword.value = ''
  error.value = ''
  report.value = null
  busy.value = false
})

function close(): void {
  if (!busy.value) emit('close')
}

async function run(): Promise<void> {
  if (!url.value || busy.value) return
  busy.value = true
  error.value = ''
  report.value = null
  try {
    const response = await $fetch<{ ok: boolean; data: AuditReportView }>('/api/v1/site-audit', {
      method: 'POST',
      body: { url: url.value.trim(), ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}) },
    })
    report.value = response.data
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Audit failed.'
  } finally {
    busy.value = false
  }
}

function statusLabel(status: string): string {
  return { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'N/A' }[status] || status.toUpperCase()
}
function badgeClass(status: string): string {
  return {
    pass: 'badge-success', warn: 'badge-warning', fail: 'badge-danger', skip: 'bg-gray-700 text-gray-400',
  }[status] || ''
}
const scoreColor = computed(() => {
  const score = report.value?.score ?? 0
  return score >= 90 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'
})
function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}
</script>

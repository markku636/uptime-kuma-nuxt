<template>
  <div class="page-container">
    <div class="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-primary">Bulk website audit</h1>
        <p class="text-secondary mt-1">Inspect up to 20 URLs with the same bounded checks as the one-shot audit.</p>
      </div>
      <NuxtLink to="/dashboard" class="btn btn-secondary">Back to dashboard</NuxtLink>
    </div>

    <div class="card card-body mb-6">
      <label class="block">
        <span class="text-sm text-toned">URLs (one per line, max 20)</span>
        <textarea v-model="rawUrls" rows="8" maxlength="20000" aria-label="URLs to audit"
          placeholder="https://example.com&#10;https://markkulab.net" class="input-field mt-1 font-mono text-sm"></textarea>
      </label>
      <label class="block mt-3">
        <span class="text-sm text-toned">Expected keyword <span class="text-tertiary">(optional, applied to all)</span></span>
        <input v-model="keyword" type="text" maxlength="200" aria-label="Expected keyword" class="input-field mt-1" />
      </label>
      <p v-if="error" role="alert" class="text-sm text-red-400 mt-3">{{ error }}</p>
      <div class="flex flex-wrap gap-2 mt-4">
        <button type="button" class="btn btn-primary" :disabled="busy || !urls.length" @click="run">
          {{ busy ? `Auditing ${urls.length} URLs…` : `Audit ${urls.length || ''} URLs` }}
        </button>
        <button v-if="result" type="button" class="btn btn-secondary" @click="downloadCsv">Download CSV</button>
      </div>
    </div>

    <div v-if="result" class="card card-body">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="section-title !mb-0">Results</h2>
        <span class="badge badge-success">{{ result.passed }} clean</span>
        <span class="badge badge-warning">{{ result.failed }} with findings</span>
        <span class="badge badge-danger">{{ result.errors }} errors</span>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr><th>URL</th><th>Score</th><th>Grade</th><th>Findings</th><th>Time</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in result.results" :key="row.url">
              <td class="max-w-md truncate" :title="row.url">{{ row.url }}</td>
              <td>{{ row.score ?? '—' }}</td>
              <td><span class="badge">{{ row.grade || row.status }}</span></td>
              <td class="text-sm text-secondary">{{ row.error || row.failedChecks.join(', ') || '—' }}</td>
              <td class="text-sm text-tertiary">{{ row.durationMs }} ms</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

interface BatchRow {
  url: string
  status: 'ok' | 'error'
  score: number | null
  grade: string | null
  finalUrl: string | null
  durationMs: number
  failedChecks: string[]
  error: string | null
}
interface BatchResult { results: BatchRow[]; passed: number; failed: number; errors: number }

const rawUrls = ref('')
const keyword = ref('')
const busy = ref(false)
const error = ref('')
const result = ref<BatchResult | null>(null)

const urls = computed(() => rawUrls.value.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 20))

async function run(): Promise<void> {
  if (!urls.value.length || busy.value) return
  busy.value = true
  error.value = ''
  result.value = null
  try {
    const response = await $fetch<{ ok: boolean; data: BatchResult }>('/api/v1/site-audit/batch', {
      method: 'POST',
      body: { urls: urls.value, ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}) },
    })
    result.value = response.data
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Batch audit failed.'
  } finally {
    busy.value = false
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
function downloadCsv(): void {
  if (!result.value) return
  const lines = [
    ['url', 'status', 'score', 'grade', 'findings', 'durationMs'].join(','),
    ...result.value.results.map(row => [
      csvCell(row.url), csvCell(row.status), csvCell(row.score), csvCell(row.grade),
      csvCell(row.error || row.failedChecks.join(' ')), csvCell(row.durationMs),
    ].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `site-audit-bulk-${Date.now()}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

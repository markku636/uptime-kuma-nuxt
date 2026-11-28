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
      <label class="block mt-3">
        <span class="text-sm text-toned">Expected HTTP status <span class="text-tertiary">(optional, applied to all)</span></span>
        <input v-model.number="expectedStatus" type="number" min="100" max="599" aria-label="Expected HTTP status" placeholder="200" class="input-field mt-1 w-40" />
      </label>
      <div class="flex flex-wrap gap-3 mt-3">
        <label v-for="item in checkOptions" :key="item.id" class="flex items-center gap-1 text-sm text-toned">
          <input v-model="enabledChecks[item.id]" type="checkbox" :aria-label="`Enable ${item.id} check`" />
          {{ item.label }}
        </label>
      </div>
      <p v-if="error" role="alert" class="text-sm text-red-400 mt-3">{{ error }}</p>
      <div class="flex flex-wrap gap-2 mt-4">
        <button type="button" class="btn btn-primary" :disabled="busy || !urls.length" @click="run">
          {{ busy ? `Auditing ${urls.length} URLs…` : `Audit ${urls.length || ''} URLs` }}
        </button>
        <button v-if="result" type="button" class="btn btn-secondary" @click="downloadCsv">Download CSV</button>
      </div>
    </div>

    <div class="card card-body mb-6">
      <h2 class="section-title">Compare two sites</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="block">
          <span class="text-sm text-toned">Site A</span>
          <input v-model="compareA" type="url" maxlength="8192" aria-label="Compare site A" class="input-field mt-1" placeholder="https://example.com" />
        </label>
        <label class="block">
          <span class="text-sm text-toned">Site B</span>
          <input v-model="compareB" type="url" maxlength="8192" aria-label="Compare site B" class="input-field mt-1" placeholder="https://example.org" />
        </label>
      </div>
      <div class="mt-4">
        <button type="button" class="btn btn-secondary" :disabled="comparing || !compareA || !compareB" @click="compare">
          {{ comparing ? 'Comparing…' : 'Compare' }}
        </button>
      </div>
      <div v-if="compareResult" class="overflow-x-auto mt-4">
        <table class="table">
          <thead><tr><th>Check</th><th>A · {{ compareA }}</th><th>B · {{ compareB }}</th></tr></thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.id">
              <td class="font-medium">{{ row.label }}</td>
              <td :class="row.diff ? 'text-amber-500' : 'text-secondary'">{{ row.a }}</td>
              <td :class="row.diff ? 'text-amber-500' : 'text-secondary'">{{ row.b }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-sm text-secondary mt-2">Score: {{ compareResult.a?.score }} vs {{ compareResult.b?.score }}</p>
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
const expectedStatus = ref<number | null>(null)
const compareA = ref('')
const compareB = ref('')
const comparing = ref(false)
const compareResult = ref<{ a: any; b: any } | null>(null)
const compareRows = computed(() => {
  const a = new Map<string, any>((compareResult.value?.a?.checks || []).map((check: any) => [check.id, check]))
  const b = new Map<string, any>((compareResult.value?.b?.checks || []).map((check: any) => [check.id, check]))
  return [...new Set([...a.keys(), ...b.keys()])].map(id => {
    const left = a.get(id), right = b.get(id)
    return {
      id, label: left?.label || right?.label || id,
      a: left ? `${left.status} · ${left.summary}` : '—',
      b: right ? `${right.status} · ${right.summary}` : '—',
      diff: (left?.status || '') !== (right?.status || '') || (left?.summary || '') !== (right?.summary || ''),
    }
  })
})
const checkOptions = [
  { id: 'tls', label: 'TLS' }, { id: 'dns', label: 'DNS' }, { id: 'headers', label: 'Headers' },
  { id: 'meta', label: 'Metadata' }, { id: 'links', label: 'Links' }, { id: 'keyword', label: 'Keyword' },
] as const
const enabledChecks = ref<Record<string, boolean>>({ tls: true, dns: true, headers: true, meta: true, links: true, keyword: true })
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
      body: {
        urls: urls.value,
        ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
        checks: Object.fromEntries(checkOptions.map(option => [option.id, enabledChecks.value[option.id] !== false])),
        ...(Number.isInteger(expectedStatus.value) && Number(expectedStatus.value) >= 100 && Number(expectedStatus.value) <= 599 ? { expectedStatus: Number(expectedStatus.value) } : {}),
      },
    })
    result.value = response.data
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Batch audit failed.'
  } finally {
    busy.value = false
  }
}

async function compare(): Promise<void> {
  if (!compareA.value || !compareB.value || comparing.value) return
  comparing.value = true
  error.value = ''
  compareResult.value = null
  try {
    const body = { checks: Object.fromEntries(checkOptions.map(option => [option.id, enabledChecks.value[option.id] !== false])), ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}) }
    const [a, b] = await Promise.all([compareA.value, compareB.value].map(url =>
      $fetch<{ ok: boolean; data: any }>('/api/v1/site-audit', { method: 'POST', body: { ...body, url } })))
    compareResult.value = { a: a.data, b: b.data }
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Compare failed.'
  } finally {
    comparing.value = false
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

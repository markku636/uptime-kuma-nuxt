<template>
  <div class="page-container">
    <div class="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-primary">Security scan</h1>
        <p class="text-secondary mt-1">Bounded vulnerability checks against sites you own — passive by default, light probes only after ownership is verified.</p>
      </div>
      <NuxtLink to="/dashboard" class="btn btn-secondary">Back to dashboard</NuxtLink>
    </div>

    <div class="card card-body mb-6">
      <label class="block">
        <span class="text-sm text-toned">Target URL</span>
        <input v-model="url" type="url" maxlength="8192" aria-label="Target URL" class="input-field mt-1 font-mono text-sm" placeholder="https://example.com" />
      </label>

      <div class="mt-4">
        <span class="text-sm text-toned">Scan profile</span>
        <div class="flex flex-wrap gap-4 mt-1">
          <label class="flex items-center gap-1 text-sm text-toned">
            <input v-model="profile" type="radio" value="passive" aria-label="Passive profile" /> Passive
            <span class="text-tertiary">(browser-like requests)</span>
          </label>
          <label class="flex items-center gap-1 text-sm text-toned">
            <input v-model="profile" type="radio" value="active_light" aria-label="Active light profile" /> Active light
            <span class="text-tertiary">(needs ownership proof)</span>
          </label>
        </div>
      </div>

      <div v-if="profile === 'active_light'" class="mt-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
        <p class="text-sm text-toned mb-2">Prove ownership once (valid 90 days). Do not scan systems you do not own or have written permission to test.</p>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-secondary" :disabled="issuing || !url" @click="issueToken">
            {{ issuing ? 'Issuing…' : 'Get verification code' }}
          </button>
          <select v-model="verifyMethod" aria-label="Verification method" class="input-field w-auto">
            <option value="dns-txt">DNS TXT</option>
            <option value="well-known">Well-known file</option>
          </select>
        </div>
        <div v-if="issued" class="mt-3 text-sm font-mono space-y-1">
          <p v-for="(line, index) in issued.instructions" :key="index" class="text-secondary break-all">{{ line }}</p>
        </div>
        <label class="block mt-3">
          <span class="text-sm text-toned">Verification token</span>
          <input v-model="token" type="text" maxlength="128" aria-label="Verification token" class="input-field mt-1 font-mono text-sm" placeholder="sealscan-…" />
        </label>
      </div>

      <div class="flex flex-wrap gap-3 mt-4">
        <label v-for="item in categories" :key="item.id" class="flex items-center gap-1 text-sm text-toned">
          <input v-model="enabled[item.id]" type="checkbox" :aria-label="`Enable ${item.id} check`" /> {{ item.label }}
        </label>
      </div>
      <label class="block mt-3">
        <span class="text-sm text-toned">Active probe limit (0–6)</span>
        <input v-model.number="maxProbes" type="number" min="0" max="6" aria-label="Active probe limit" class="input-field mt-1 w-32" />
      </label>
      <label class="block mt-3">
        <span class="text-sm text-toned">Schedule threshold (0–100, DOWN below this score)</span>
        <input v-model.number="minScore" type="number" min="0" max="100" aria-label="Schedule threshold" class="input-field mt-1 w-32" />
      </label>

      <p v-if="error" role="alert" class="text-sm text-red-400 mt-3">{{ error }}</p>
      <div class="flex flex-wrap gap-2 mt-4">
        <button type="button" class="btn btn-primary" :disabled="busy || !url" @click="run">
          {{ busy ? 'Scanning…' : 'Run scan' }}
        </button>
        <button v-if="report" type="button" class="btn btn-secondary" @click="downloadJson">Download JSON</button>
        <button v-if="report" type="button" class="btn btn-secondary" @click="downloadFindingsCsv">Findings CSV</button>
        <button v-if="report && profile === 'passive'" type="button" class="btn btn-secondary" :disabled="scheduling" @click="schedule">
          {{ scheduling ? 'Scheduling…' : 'Schedule hourly' }}
        </button>
      </div>
    </div>

    <div class="card card-body mb-6">
      <h2 class="section-title">Batch scan (passive)</h2>
      <label class="block">
        <span class="text-sm text-toned">URLs (one per line, max 20)</span>
        <textarea v-model="batchRaw" rows="6" maxlength="20000" aria-label="URLs to scan"
          placeholder="https://example.com&#10;https://example.org" class="input-field mt-1 font-mono text-sm"></textarea>
      </label>
      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" class="btn btn-secondary" :disabled="batchBusy || !batchUrls.length" @click="runBatch">
          {{ batchBusy ? `Scanning ${batchUrls.length} sites…` : `Scan ${batchUrls.length || ''} sites` }}
        </button>
        <button v-if="batchResult" type="button" class="btn btn-secondary" @click="downloadBatchCsv">Download CSV</button>
      </div>
      <div v-if="batchResult" class="overflow-x-auto mt-4">
        <table class="table">
          <thead><tr><th>URL</th><th>Score</th><th>Grade</th><th>Risk</th><th>Findings</th><th>Time</th></tr></thead>
          <tbody>
            <tr v-for="row in batchResult.results" :key="row.url">
              <td class="max-w-md truncate" :title="row.url">{{ row.url }}</td>
              <td>{{ row.score ?? '—' }}</td>
              <td>{{ row.grade || row.status }}</td>
              <td>{{ row.riskLevel || row.error || '—' }}</td>
              <td>{{ row.findings }}</td>
              <td>{{ row.durationMs }} ms</td>
            </tr>
          </tbody>
        </table>
        <p class="text-sm text-secondary mt-2">{{ batchResult.passed }} healthy · {{ batchResult.failed }} low score · {{ batchResult.errors }} errors</p>
      </div>
    </div>

    <div v-if="report" class="card card-body">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="section-title !mb-0">Report</h2>
        <span class="badge" :class="gradeClass(report.grade)">{{ report.score }}/100 · {{ report.grade }}</span>
        <span class="badge" :class="severityClass(report.riskLevel)">Risk: {{ report.riskLevel }}</span>
        <span class="badge badge-secondary">{{ report.profile }}</span>
        <span class="text-sm text-tertiary">{{ report.durationMs }} ms · {{ report.findings.length }} findings</span>
        <span v-for="severity in severityOrder" :key="severity" class="badge" :class="severityClass(severity)" v-show="severityCounts[severity]">
          {{ severity }} {{ severityCounts[severity] }}
        </span>
      </div>

      <div class="grid gap-3 md:grid-cols-2 mb-4">
        <div class="text-sm text-secondary">
          <p>Target: <span class="font-mono">{{ report.url }}</span></p>
          <p>Final: <span class="font-mono">{{ report.finalUrl }}</span></p>
          <p>HTTP {{ report.fingerprint.status ?? '—' }} · <span v-for="(tech, index) in report.fingerprint.technologies" :key="tech">{{ index ? ', ' : '' }}{{ tech }}</span><span v-if="!report.fingerprint.technologies.length">no technology fingerprint</span></p>
        </div>
        <div class="text-sm text-secondary">
          <p v-for="(warning, index) in report.warnings" :key="index" class="text-amber-400">{{ warning }}</p>
          <p v-if="!report.warnings.length">No warnings.</p>
          <p class="text-tertiary">Probes used {{ report.limits.probesUsed }}/{{ report.limits.maxProbes }}</p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Severity</th><th>Category</th><th>Finding</th><th>Recommendation</th></tr></thead>
          <tbody>
            <tr v-for="finding in visibleFindings" :key="finding.key">
              <td><span class="badge" :class="severityClass(finding.severity)">{{ finding.severity }}</span></td>
              <td class="text-sm text-tertiary">{{ finding.category }}</td>
              <td>
                <p class="font-medium">{{ finding.title }}</p>
                <p class="text-sm text-secondary">{{ finding.detail }}</p>
                <p v-if="finding.refs.length" class="text-xs text-tertiary break-all">{{ finding.refs.join(' · ') }}</p>
              </td>
              <td class="text-sm text-secondary">{{ finding.recommendation }}</td>
            </tr>
            <tr v-if="!visibleFindings.length"><td colspan="4" class="text-secondary">No findings in this view.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center gap-3 mt-4">
        <label class="flex items-center gap-1 text-sm text-toned">
          <input v-model="showInfo" type="checkbox" aria-label="Show info findings" /> Show info
        </label>
        <label class="flex items-center gap-1 text-sm text-toned">
          <input v-model="showLow" type="checkbox" aria-label="Show low findings" /> Show low
        </label>
        <span class="text-sm text-tertiary">{{ visibleFindings.length }} / {{ report.findings.length }} shown</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

interface Finding {
  key: string
  rule: string
  category: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  title: string
  detail: string
  recommendation: string
  location: { url?: string; host?: string; param?: string }
  evidence: Record<string, unknown>
  cwe: string[]
  refs: string[]
  tags: string[]
}
interface Report {
  url: string
  finalUrl: string
  host: string
  profile: string
  checkedAt: string
  durationMs: number
  score: number
  grade: string
  riskLevel: Finding['severity'] | 'none'
  findings: Finding[]
  fingerprint: { status: number | null; title: string | null; server: string | null; technologies: string[]; finalUrl: string; redirects: number }
  warnings: string[]
  limits: { maxProbes: number; probesUsed: number; maxFindings: number }
}

const categories = [
  { id: 'fingerprint', label: 'Fingerprint' }, { id: 'headers', label: 'Headers' },
  { id: 'cookies', label: 'Cookies' }, { id: 'tls', label: 'TLS' },
  { id: 'dns', label: 'DNS' }, { id: 'redirect', label: 'Redirect' },
  { id: 'exposure', label: 'Exposure' },
] as const
type CategoryId = typeof categories[number]['id']

const url = ref('')
const profile = ref<'passive' | 'active_light'>('passive')
const verifyMethod = ref<'dns-txt' | 'well-known'>('dns-txt')
const token = ref('')
const issued = ref<{ token: string; dnsName: string; dnsValue: string; wellKnownUrl: string; expiresAt: string; instructions: string[] } | null>(null)
const enabled = ref<Record<CategoryId, boolean>>({
  fingerprint: true, headers: true, cookies: true, tls: true, dns: true, redirect: true, exposure: true,
})
const maxProbes = ref(3)
const minScore = ref(60)
const severityOrder = ['critical', 'high', 'medium', 'low', 'info'] as const
const severityCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const finding of report.value?.findings || []) counts[finding.severity] = (counts[finding.severity] || 0) + 1
  return counts
})
const batchRaw = ref('')
const batchResult = ref<{ results: Array<{ url: string; status: string; score: number | null; grade: string | null; riskLevel: string | null; findings: number; durationMs: number; error: string | null }>; passed: number; failed: number; errors: number } | null>(null)
const batchBusy = ref(false)
const batchUrls = computed(() => batchRaw.value.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 20))
const busy = ref(false)
const scheduling = ref(false)
const issuing = ref(false)
const error = ref('')
const report = ref<Report | null>(null)
const showInfo = ref(false)
const showLow = ref(true)

const visibleFindings = computed(() => (report.value?.findings || []).filter(finding => {
  const hiddenInfo = finding.severity === 'info' && !showInfo.value
  const hiddenLow = finding.severity === 'low' && !showLow.value
  return !hiddenInfo && !hiddenLow
}))

function severityClass(severity: string): string {
  return severity === 'critical' || severity === 'high' ? 'badge-danger'
    : severity === 'medium' ? 'badge-warning'
      : severity === 'low' ? 'badge-secondary' : 'badge-success'
}
function gradeClass(grade: string): string {
  return grade === 'A' ? 'badge-success' : grade === 'B' ? 'badge-secondary' : 'badge-warning'
}

async function issueToken(): Promise<void> {
  if (!url.value || issuing.value) return
  issuing.value = true
  error.value = ''
  try {
    const response = await $fetch<{ ok: boolean; data: typeof issued.value }>('/api/v1/security-scan/verify-token', {
      query: { url: url.value },
    })
    issued.value = response.data
    token.value = response.data?.token || ''
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Could not issue verification code.'
  } finally {
    issuing.value = false
  }
}

async function run(): Promise<void> {
  if (!url.value || busy.value) return
  busy.value = true
  error.value = ''
  report.value = null
  try {
    const body: Record<string, unknown> = {
      url: url.value,
      profile: profile.value,
      maxProbes: Math.max(0, Math.min(6, Number(maxProbes.value) || 0)),
      categories: Object.fromEntries(categories.map(category => [category.id, enabled.value[category.id] !== false])),
    }
    if (profile.value === 'active_light' && token.value.trim()) {
      body.verify = { method: verifyMethod.value, token: token.value.trim() }
    }
    const response = await $fetch<{ ok: boolean; data: Report }>('/api/v1/security-scan', { method: 'POST', body })
    report.value = response.data
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Security scan failed.'
  } finally {
    busy.value = false
  }
}

async function runBatch(): Promise<void> {
  if (!batchUrls.value.length || batchBusy.value) return
  batchBusy.value = true
  error.value = ''
  batchResult.value = null
  try {
    const response = await $fetch<{ ok: boolean; data: NonNullable<typeof batchResult.value> }>('/api/v1/security-scan/batch', {
      method: 'POST', body: { urls: batchUrls.value },
    })
    batchResult.value = response.data
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Batch scan failed.'
  } finally {
    batchBusy.value = false
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
function downloadBatchCsv(): void {
  if (!batchResult.value) return
  const lines = [
    ['url', 'status', 'score', 'grade', 'risk', 'findings', 'durationMs'].join(','),
    ...batchResult.value.results.map(row => [
      csvCell(row.url), csvCell(row.status), csvCell(row.score), csvCell(row.grade),
      csvCell(row.riskLevel || row.error), csvCell(row.findings), csvCell(row.durationMs),
    ].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const link = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = link
  anchor.download = `security-scan-batch-${Date.now()}.csv`
  anchor.click()
  URL.revokeObjectURL(link)
}

async function schedule(): Promise<void> {
  if (!url.value || scheduling.value || profile.value !== 'passive') return
  scheduling.value = true
  error.value = ''
  try {
    const config = {
      url: url.value.trim(), minScore: Math.max(0, Math.min(100, Number(minScore.value) || 60)),
      categories: Object.fromEntries(categories.map(category => [category.id, enabled.value[category.id] !== false])),
    }
    let name = url.value.trim()
    try { name = new URL(name).hostname.replace(/^www\./, '') } catch { /* keep raw input */ }
    await $fetch('/api/v1/monitors', {
      method: 'POST',
      body: {
        name: `Security scan · ${name.slice(0, 160)}`, type: 'security-scan',
        url: url.value.trim(), body: JSON.stringify(config),
        interval: 3600, timeout: 60, method: 'GET', active: true,
      },
    })
    error.value = 'Scheduled: runs hourly; the score becomes the monitor heartbeat.'
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Could not schedule scan.'
  } finally {
    scheduling.value = false
  }
}

function downloadFindingsCsv(): void {
  if (!report.value) return
  const lines = [
    ['severity', 'category', 'rule', 'title', 'detail', 'recommendation', 'cwe', 'refs'].join(','),
    ...report.value.findings.map(finding => [
      csvCell(finding.severity), csvCell(finding.category), csvCell(finding.rule),
      csvCell(finding.title), csvCell(finding.detail), csvCell(finding.recommendation),
      csvCell(finding.cwe.join(' ')), csvCell(finding.refs.join(' ')),
    ].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const link = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = link
  anchor.download = `security-scan-findings-${Date.now()}.csv`
  anchor.click()
  URL.revokeObjectURL(link)
}

function downloadJson(): void {
  if (!report.value) return
  const blob = new Blob([JSON.stringify(report.value, null, 2)], { type: 'application/json' })
  const link = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = link
  anchor.download = `security-scan-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(link)
}
</script>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const periods = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '1y', label: 'Last year' },
] as const
const period = ref<(typeof periods)[number]['value']>('30d')
const loading = ref(true)
const rows = ref<any[]>([])
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<any>('/api/v1/monitors', { query: { limit: 200 } })
    const monitors = result?.data || []
    if (!monitors.length) { rows.value = []; return }
    // Batches of 100 keep the endpoint within its bounded fan-out.
    const batches: string[] = []
    for (let i = 0; i < monitors.length; i += 100) batches.push(monitors.slice(i, i + 100).map((m: any) => m.id).join(','))
    const responses = await Promise.all(batches.map(idsPart => $fetch<any>('/api/v1/monitors/uptime-batch', {
      query: { ids: idsPart, period: period.value, details: 'true' },
    })))
    const details = Object.assign({}, ...responses.map(r => r.details || {}))
    rows.value = monitors.map((m: any) => {
      const d = details[String(m.id)] || {}
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        active: m.active,
        uptime: typeof d.uptime === 'number' ? `${d.uptime.toFixed(2)}%` : '—',
        downtime: d.downtimeMinutes ? `${d.downtimeMinutes} min` : '0 min',
        checks: `${d.upCount || 0} / ${(d.upCount || 0) + (d.downCount || 0)}`,
        coverage: typeof d.coverage === 'number' ? `${Math.round(d.coverage * 100)}%` : '—',
      }
    }).sort((a, b) => parseFloat(b.uptime) - parseFloat(a.uptime))
  } catch (e: any) {
    error.value = e?.data?.message || 'Unable to load report'
  } finally {
    loading.value = false
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  // Spreadsheet formula injection guard.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

function exportCsv() {
  if (!rows.value.length) return
  const header = ['Monitor', 'Type', 'Status', 'Uptime', 'Downtime', 'Checks (up/total)', 'Coverage']
  const lines = [header.map(csvCell).join(',')]
  for (const row of rows.value) {
    lines.push([row.name, row.type, row.active ? 'active' : 'paused', row.uptime,
      row.downtime, row.checks, row.coverage].map(csvCell).join(','))
  }
  const blob = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `availability-${period.value}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

onMounted(load)
watch(period, load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">Availability report</h1>
        <p class="text-sm text-toned mt-1">Uptime, downtime and check counts across your monitors (first 200).</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-for="item in periods" :key="item.value" class="btn btn-secondary"
          :class="period === item.value ? 'ring-2 ring-primary' : ''" @click="period = item.value">
          {{ item.label }}
        </button>
        <button class="btn btn-primary" :disabled="!rows.length || loading" @click="exportCsv">
          Export CSV
        </button>
      </div>
    </div>

    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <p v-if="loading" class="text-secondary">Loading report…</p>
    <div v-else-if="!rows.length" class="card card-body text-center text-secondary">No monitors to report yet.</div>
    <div v-else class="card overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Monitor</th>
            <th>Type</th>
            <th>Uptime</th>
            <th>Downtime</th>
            <th>Checks (up/total)</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="hover-row">
            <td>
              <NuxtLink :to="`/monitors/${row.id}`" class="link font-medium">{{ row.name }}</NuxtLink>
              <span v-if="!row.active" class="text-xs text-secondary ml-2">paused</span>
            </td>
            <td class="text-secondary uppercase text-sm">{{ row.type }}</td>
            <td class="font-medium">{{ row.uptime }}</td>
            <td class="text-secondary">{{ row.downtime }}</td>
            <td class="text-secondary">{{ row.checks }}</td>
            <td class="text-secondary">{{ row.coverage }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

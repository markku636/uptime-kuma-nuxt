<template>
  <div class="page-container">
    <div class="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-primary">Monitoring as code</h1>
        <p class="text-secondary mt-1">Export a declarative document, preview the diff, then apply atomically. Secrets are never exported or accepted.</p>
      </div>
      <NuxtLink to="/dashboard" class="btn btn-secondary">Back to dashboard</NuxtLink>
    </div>

    <div class="card card-body mb-6">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <button class="btn btn-secondary" :disabled="busy" @click="loadCurrent">Download current</button>
        <button class="btn btn-secondary" :disabled="busy || !text" @click="preview">Preview diff</button>
        <label class="flex items-center gap-2 text-sm text-toned">
          <input v-model="activate" type="checkbox" />
          Activate after apply
        </label>
      </div>
      <textarea v-model="text" rows="18" maxlength="2000000" aria-label="Declarative document"
        placeholder='{"version":"1.0","monitors":[]}' class="input-field font-mono text-xs"></textarea>
      <p v-if="error" role="alert" class="text-sm text-red-400 mt-3">{{ error }}</p>
      <div v-if="plan.length" class="mt-4 overflow-x-auto">
        <table class="table">
          <thead><tr><th>Action</th><th>Monitor</th><th>Changes</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in plan" :key="index">
              <td><span class="badge" :class="row.action === 'create' ? 'badge-success' : row.action === 'update' ? 'badge-warning' : ''">{{ row.action }}</span></td>
              <td>{{ row.name }}</td>
              <td class="text-sm text-secondary">{{ row.changes.join(', ') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="plan.length" class="flex justify-end gap-2 mt-4">
        <button class="btn btn-primary" :disabled="busy || !plan.some(row => row.action !== 'nochange')" @click="apply">Apply</button>
      </div>
      <p v-if="applied" role="status" class="text-sm text-emerald-400 mt-3">{{ applied }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

interface PlanRow { action: 'create' | 'update' | 'nochange'; name: string; changes: string[] }

const text = ref('')
const plan = ref<PlanRow[]>([])
const activate = ref(false)
const busy = ref(false)
const error = ref('')
const applied = ref('')

function download(value: string, filename: string): void {
  const blob = new Blob([value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function loadCurrent(): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<any>('/api/v1/monitoring/export')
    text.value = JSON.stringify(res.data, null, 2)
    plan.value = []
    download(text.value, `monitoring-${Date.now()}.json`)
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Export failed.'
  } finally { busy.value = false }
}

function documentFromText(): any | null {
  try { return JSON.parse(text.value) } catch { error.value = 'Document is not valid JSON.'; return null }
}

async function preview(): Promise<void> {
  const doc = documentFromText()
  if (!doc) return
  busy.value = true
  error.value = ''
  plan.value = []
  applied.value = ''
  try {
    const res = await $fetch<any>('/api/v1/monitoring/plan', { method: 'POST', body: doc })
    plan.value = res.data?.plan || []
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Preview failed.'
  } finally { busy.value = false }
}

async function apply(): Promise<void> {
  const doc = documentFromText()
  if (!doc) return
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<any>('/api/v1/monitoring/apply', { method: 'POST', body: { document: doc, activate: activate.value } })
    const data = res.data
    applied.value = `Applied: ${data.created.length} created, ${data.updated.length} updated, ${data.unchanged.length} unchanged.`
    plan.value = []
  } catch (caught: any) {
    error.value = caught?.data?.message || caught?.message || 'Apply failed.'
  } finally { busy.value = false }
}
</script>

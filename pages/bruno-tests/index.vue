<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
const rows = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const router = useRouter()
const trying = ref(false)
const runningId = ref<number | null>(null)

async function runSuite(id: number) {
  runningId.value = id
  error.value = ''
  try {
    await $fetch(`/api/v1/bruno/tests/${id}/run`, { method: 'POST' })
    router.push(`/bruno-tests/${id}`)
  } catch (e: any) { error.value = e.data?.message || 'Run failed' }
  finally { runningId.value = null }
}

async function tryExample() {
  trying.value = true
  error.value = ''
  try {
    const manifest = brunoTestExample()
    const preview = await $fetch<any>('/api/v1/bruno/tests/preview', { method: 'POST', body: manifest })
    if (!preview.ok) throw new Error(preview.issues?.[0]?.code || 'Example preview failed')
    const created = await $fetch<any>('/api/v1/bruno/tests', { method: 'POST', body: { ...manifest, digest: preview.digest } })
    router.push(`/bruno-tests/${created.data.id}`)
  } catch (e: any) { error.value = e.data?.message || e.message || 'Could not create example test' }
  finally { trying.value = false }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<any>('/api/v1/bruno/tests')
    rows.value = result.data || []
  } catch (e: any) {
    error.value = e.data?.message || 'Unable to load Bruno tests'
  } finally { loading.value = false }
}

async function remove(id: number) {
  if (!confirm('Delete this Bruno test suite and its report history?')) return
  try {
    await $fetch(`/api/v1/bruno/tests/${id}`, { method: 'DELETE' })
    await load()
  } catch (e: any) { error.value = e.data?.message || 'Delete failed' }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">{{ $t('btTitle') }}</h1>
        <p class="text-sm text-secondary">{{ $t('btIntro') }}</p>
      </div>
      <div class="flex gap-2"><button class="btn btn-secondary" :disabled="trying" @click="tryExample">{{ trying ? $t('btCreating') : $t('btTryExample') }}</button><NuxtLink to="/bruno-tests/new" class="btn btn-primary">{{ $t('btNew') }}</NuxtLink></div>
    </div>
    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <p v-if="loading">Loading…</p>
    <div v-else-if="!rows.length" class="card p-8 text-center space-y-4">
        <p class="text-secondary">{{ $t('btEmptySteps') }}</p>
        <ol class="text-sm text-secondary mx-auto max-w-md text-left list-decimal list-inside space-y-1">
          <li>Upload a Bruno collection (.bru files or ZIP), or paste one request.</li>
          <li>Preview the ordered steps and click <strong>Create test</strong>.</li>
          <li>Press <strong>Run test</strong> and read the report.</li>
        </ol>
        <button class="btn btn-primary" :disabled="trying" @click="tryExample">{{ trying ? $t('btCreating') : $t('btTryExample') }}</button>
      </div>
    <div v-else class="card overflow-x-auto">
      <table class="table">
        <thead><tr><th>Name</th><th>Collection</th><th>Steps</th><th>{{ $t('btSchedule') }}</th><th>{{ $t('btLastRun') }}</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td><NuxtLink :to="`/bruno-tests/${row.id}`" class="link">{{ row.name }}</NuxtLink></td>
            <td class="font-mono text-xs">{{ row.collectionId }}</td>
            <td>{{ row.steps }}</td>
            <td class="text-xs text-secondary">
              <template v-if="row.scheduleIntervalSec">{{ row.scheduleIntervalSec / 60 }} min · {{ row.nextRunAt ? new Date(row.nextRunAt).toLocaleString() : 'pending' }}</template>
              <template v-else>{{ $t('btManual') }}</template>
            </td>
            <td class="text-xs">
              <template v-if="row.lastRun">
                <span :class="row.lastRun.status === 'pass' ? 'text-green-500' : 'text-red-400'">{{ row.lastRun.status }}</span>
                <span class="text-secondary"> · #{{ row.lastRun.id }} {{ new Date(row.lastRun.startedAt).toLocaleString() }}</span>
              </template>
              <span v-else class="text-secondary">—</span>
            </td>
            <td class="text-xs text-secondary">{{ new Date(row.updatedAt).toLocaleString() }}</td>
            <td class="text-right space-x-2">
              <button class="btn btn-primary btn-sm" :disabled="runningId === row.id" @click="runSuite(row.id)">{{ runningId === row.id ? $t('btCreating') : $t('btRun') }}</button>
              <button class="btn btn-danger btn-sm" @click="remove(row.id)">{{ $t('btDelete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

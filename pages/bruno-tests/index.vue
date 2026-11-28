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
        <h1 class="text-2xl font-semibold">Bruno Tests</h1>
        <p class="text-sm text-secondary">Run a Bruno collection as one ordered API test and keep the report.</p>
      </div>
      <div class="flex gap-2"><button class="btn btn-secondary" :disabled="trying" @click="tryExample">{{ trying ? 'Creating…' : 'Try example test' }}</button><NuxtLink to="/bruno-tests/new" class="btn btn-primary">New test from collection</NuxtLink></div>
    </div>
    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <p v-if="loading">Loading…</p>
    <div v-else-if="!rows.length" class="card p-8 text-center space-y-4">
        <p class="text-secondary">No Bruno test suites yet. Start in three steps:</p>
        <ol class="text-sm text-secondary mx-auto max-w-md text-left list-decimal list-inside space-y-1">
          <li>Upload a Bruno collection (.bru files or ZIP), or paste one request.</li>
          <li>Preview the ordered steps and click <strong>Create test</strong>.</li>
          <li>Press <strong>Run test</strong> and read the report.</li>
        </ol>
        <button class="btn btn-primary" :disabled="trying" @click="tryExample">{{ trying ? 'Creating…' : 'Try example test' }}</button>
      </div>
    <div v-else class="card overflow-x-auto">
      <table class="table">
        <thead><tr><th>Name</th><th>Collection</th><th>Steps</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td><NuxtLink :to="`/bruno-tests/${row.id}`" class="link">{{ row.name }}</NuxtLink></td>
            <td class="font-mono text-xs">{{ row.collectionId }}</td>
            <td>{{ row.steps }}</td>
            <td class="text-xs text-secondary">{{ new Date(row.updatedAt).toLocaleString() }}</td>
            <td class="text-right space-x-2">
              <button class="btn btn-primary btn-sm" :disabled="runningId === row.id" @click="runSuite(row.id)">{{ runningId === row.id ? 'Running…' : 'Run' }}</button>
              <button class="btn btn-danger btn-sm" @click="remove(row.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

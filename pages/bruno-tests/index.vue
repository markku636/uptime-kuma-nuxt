<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
const rows = ref<any[]>([])
const loading = ref(true)
const error = ref('')

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
      <NuxtLink to="/bruno-tests/new" class="btn btn-primary">New test from collection</NuxtLink>
    </div>
    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <p v-if="loading">Loading…</p>
    <div v-else-if="!rows.length" class="card p-8 text-center text-secondary">No Bruno test suites yet.</div>
    <div v-else class="card overflow-x-auto">
      <table class="table">
        <thead><tr><th>Name</th><th>Collection</th><th>Steps</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td><NuxtLink :to="`/bruno-tests/${row.id}`" class="link">{{ row.name }}</NuxtLink></td>
            <td class="font-mono text-xs">{{ row.collectionId }}</td>
            <td>{{ row.steps }}</td>
            <td class="text-xs text-secondary">{{ new Date(row.updatedAt).toLocaleString() }}</td>
            <td class="text-right"><button class="btn btn-danger btn-sm" @click="remove(row.id)">Delete</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

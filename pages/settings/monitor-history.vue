<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()
const loading = ref(true)
const clearing = ref(false)
const shrinking = ref(false)
const retentionDays = ref(180)
const dbSize = ref<string | null>(null)
const heartbeatCount = ref<number | null>(null)

onMounted(async () => { 
  await fetchStats()
  loading.value = false 
})

async function fetchStats() {
  try {
    const stats = await $fetch('/api/v1/monitor-history/stats') as any
    if (stats) {
      dbSize.value = stats.dbSize || null
      heartbeatCount.value = stats.heartbeatCount || null
      retentionDays.value = stats.keepDataPeriodDays || 180
    }
  } catch (error) {
    // Use defaults
  }
}

async function saveRetention() {
  try {
    await $fetch('/api/settings', { 
      method: 'POST', 
      body: { keepDataPeriodDays: retentionDays.value } 
    })
    toast.add({ title: 'Success', description: 'Retention period saved', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  }
}

async function clearHistory() {
  if (!confirm(`This will delete all heartbeat data older than ${retentionDays.value} days. Continue?`)) return
  clearing.value = true
  try {
    await $fetch('/api/v1/monitor-history/clear', { method: 'POST', body: { days: retentionDays.value } })
    toast.add({ title: 'Success', description: 'History cleared', color: 'success' })
    await fetchStats()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to clear', color: 'error' })
  } finally {
    clearing.value = false
  }
}

async function clearAllHistory() {
  if (!confirm('This will delete ALL heartbeat data. This cannot be undone. Continue?')) return
  clearing.value = true
  try {
    await $fetch('/api/v1/monitor-history/clear-all', { method: 'POST' })
    toast.add({ title: 'Success', description: 'All history cleared', color: 'success' })
    await fetchStats()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to clear', color: 'error' })
  } finally {
    clearing.value = false
  }
}

async function shrinkDatabase() {
  shrinking.value = true
  try {
    const result = await $fetch('/api/v1/monitor-history/shrink', { method: 'POST' }) as any
    toast.add({ 
      title: 'Success', 
      description: result?.message || 'Database optimized', 
      color: 'success' 
    })
    await fetchStats()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to shrink database', color: 'error' })
  } finally {
    shrinking.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Database Info -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Database Info</h5>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="p-4 bg-gray-700 rounded-lg">
          <span class="text-sm text-gray-400 block mb-1">Database Size</span>
          <strong class="text-white text-lg">{{ dbSize || 'Unknown' }}</strong>
        </div>
        <div class="p-4 bg-gray-700 rounded-lg">
          <span class="text-sm text-gray-400 block mb-1">Total Heartbeats</span>
          <strong class="text-white text-lg">{{ heartbeatCount?.toLocaleString() || 'Unknown' }}</strong>
        </div>
      </div>
      
      <button class="btn btn-secondary" :disabled="shrinking" @click="shrinkDatabase">
        <span v-if="shrinking" class="flex items-center gap-2">
          <span class="spinner w-4 h-4"></span>
          Shrinking...
        </span>
        <span v-else>Shrink Database (VACUUM)</span>
      </button>
      <p class="text-sm text-gray-500 mt-2">Reclaim disk space by optimizing the database. This may take a while for large databases.</p>
    </div>

    <!-- Data Retention -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Data Retention</h5>
      <p class="text-gray-400 mb-4">Configure how long to keep heartbeat data.</p>

      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-300 mb-2">Keep Data Period (days)</label>
        <div class="flex gap-4 items-center">
          <input v-model.number="retentionDays" type="number" class="input-field w-32" min="0" placeholder="180" />
          <button class="btn btn-primary" @click="saveRetention">Save</button>
        </div>
        <p class="text-sm text-gray-500 mt-1">Set to 0 to keep data forever. Default: 180 days.</p>
      </div>

      <div class="flex gap-4">
        <button class="btn btn-secondary" :disabled="clearing" @click="clearHistory">
          {{ clearing ? 'Clearing...' : 'Clear Old History' }}
        </button>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="section-card border border-red-500/30">
      <h5 class="text-lg font-semibold text-red-400 mb-4">⚠️ Danger Zone</h5>
      <p class="text-gray-400 mb-4">Clear all heartbeat history data. This action cannot be undone.</p>
      <button class="btn btn-danger" :disabled="clearing" @click="clearAllHistory">
        {{ clearing ? 'Clearing...' : 'Clear All Statistics' }}
      </button>
    </div>
  </div>
</template>

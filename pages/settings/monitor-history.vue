<script setup lang="ts">
const toast = useToast()
const loading = ref(true)
const clearing = ref(false)
const retentionDays = ref(180)

onMounted(async () => { loading.value = false })

async function clearHistory() {
  if (!confirm(`This will delete all heartbeat data older than ${retentionDays.value} days. Continue?`)) return
  clearing.value = true
  try {
    await $fetch('/api/v1/monitor-history/clear', { method: 'POST', body: { days: retentionDays.value } })
    toast.add({ title: 'Success', description: 'History cleared', color: 'success' })
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
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to clear', color: 'error' })
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Monitor History</h5>
      <p class="text-gray-400 mb-6">Manage your monitor heartbeat history data.</p>

      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-300 mb-2">Clear history older than (days)</label>
        <div class="flex gap-4">
          <input v-model.number="retentionDays" type="number" class="input-field w-32" min="1" />
          <button class="btn btn-primary" :disabled="clearing" @click="clearHistory">
            {{ clearing ? 'Clearing...' : 'Clear Old History' }}
          </button>
        </div>
      </div>

      <div class="pt-6 border-t border-gray-700">
        <h6 class="text-red-400 font-medium mb-2">Danger Zone</h6>
        <p class="text-gray-400 mb-4">Clear all heartbeat history data. This cannot be undone.</p>
        <button class="btn btn-danger" :disabled="clearing" @click="clearAllHistory">
          Clear All History
        </button>
      </div>
    </div>
  </div>
</template>

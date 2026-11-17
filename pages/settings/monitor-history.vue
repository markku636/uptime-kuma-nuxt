<script setup lang="ts">
// Heartbeat history: how long it is kept (the nightly cleanup), how much
// there is, and clearing it by hand.
interface HistoryInfo {
  keepDataPeriodDays: number
  heartbeatCount: number
  oldest: string | null
}

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const clearing = ref(false)
const info = ref<HistoryInfo | null>(null)
const keepDays = ref(180)
const clearDays = ref(30)

async function load() {
  try {
    info.value = await $fetch<HistoryInfo>('/api/v1/monitor-history/settings')
    keepDays.value = info.value.keepDataPeriodDays
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to load history settings', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(load)

const dirty = computed(() => info.value != null && keepDays.value !== info.value.keepDataPeriodDays)
const validKeep = computed(() => Number.isInteger(keepDays.value) && keepDays.value >= 0 && keepDays.value <= 3650)
const validClear = computed(() => Number.isInteger(clearDays.value) && clearDays.value >= 1 && clearDays.value <= 3650)

async function saveRetention() {
  if (!validKeep.value) return
  saving.value = true
  try {
    await $fetch('/api/v1/monitor-history/settings', { method: 'PUT', body: { keepDataPeriodDays: keepDays.value } })
    if (info.value) info.value.keepDataPeriodDays = keepDays.value
    toast.add({ title: 'Saved', description: keepDays.value === 0 ? 'History is kept forever' : `History is kept for ${keepDays.value} days`, color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function clear(url: string, body: Record<string, unknown> | undefined, question: string) {
  if (!confirm(question)) return
  clearing.value = true
  try {
    const result = await $fetch<{ deleted: number }>(url, { method: 'POST', body })
    toast.add({ title: 'Cleared', description: `${result.deleted.toLocaleString()} heartbeats deleted`, color: 'success' })
    await load()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to clear', color: 'error' })
  } finally {
    clearing.value = false
  }
}

const clearOld = () => clear('/api/v1/monitor-history/clear', { days: clearDays.value }, `Delete all heartbeats older than ${clearDays.value} days? This cannot be undone.`)
const clearAll = () => clear('/api/v1/monitor-history/clear-all', undefined, 'Delete ALL heartbeat history? Uptime figures start again from zero. This cannot be undone.')

const oldestText = computed(() => (info.value?.oldest ? new Date(info.value.oldest).toLocaleString() : '—'))
</script>

<template>
  <div class="space-y-6">
    <div class="section-card">
      <h5 class="text-lg font-semibold text-highlighted mb-1">Monitor History</h5>
      <p class="text-toned mb-6">Heartbeats are the checks' results; uptime figures are computed from them.</p>

      <div v-if="loading" class="text-muted">Loading…</div>
      <template v-else>
        <dl class="grid grid-cols-2 gap-4 mb-6 max-w-md">
          <div>
            <dt class="text-xs text-muted">Heartbeats stored</dt>
            <dd class="text-lg font-semibold text-highlighted">{{ (info?.heartbeatCount ?? 0).toLocaleString() }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Oldest</dt>
            <dd class="text-sm text-default mt-1">{{ oldestText }}</dd>
          </div>
        </dl>

        <form class="mb-2" @submit.prevent="saveRetention">
          <label for="keep-days" class="block text-sm font-medium text-default mb-2">Keep history for (days)</label>
          <div class="flex flex-wrap items-center gap-3">
            <input id="keep-days" v-model.number="keepDays" type="number" class="input-field w-32" min="0" max="3650" step="1" />
            <button type="submit" class="btn btn-primary" :disabled="saving || !dirty || !validKeep">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
          <p class="text-xs text-muted mt-2">
            Older heartbeats are deleted every night. 0 keeps them forever.
          </p>
        </form>
      </template>
    </div>

    <div v-if="!loading" class="section-card">
      <h6 class="font-medium text-highlighted mb-2">Clear now</h6>
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <label for="clear-days" class="text-sm text-default">Delete heartbeats older than</label>
        <input id="clear-days" v-model.number="clearDays" type="number" class="input-field w-24" min="1" max="3650" />
        <span class="text-sm text-default">days</span>
        <button class="btn btn-secondary" :disabled="clearing || !validClear" @click="clearOld">
          {{ clearing ? 'Clearing…' : 'Clear Old History' }}
        </button>
      </div>

      <div class="pt-6 border-t border-default">
        <h6 class="text-down-fg font-medium mb-2">Danger Zone</h6>
        <p class="text-toned mb-4">Delete all heartbeat history. This cannot be undone.</p>
        <button class="btn btn-danger" :disabled="clearing || !info?.heartbeatCount" @click="clearAll">
          Clear All History
        </button>
      </div>
    </div>
  </div>
</template>

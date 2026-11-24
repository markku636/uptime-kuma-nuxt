<script setup lang="ts">
definePageMeta({middleware:['auth']})
const toast=useToast()
const platformAdmin=ref(false)
// TLS Certificate Expiry Notification Settings
const tlsExpiryDays = ref<number[]>([7, 14, 21])
const newTlsExpiryDay = ref<number | null>(null)

async function fetchTlsExpirySettings() {
  try {
    const settings = await $fetch('/api/v1/settings/tls-expiry') as any
    if (settings?.days) {
      tlsExpiryDays.value = settings.days
    }
  } catch {
    // Use defaults if not found
  }
}

function addTlsExpiryDay() {
  if (newTlsExpiryDay.value && newTlsExpiryDay.value > 0 && !tlsExpiryDays.value.includes(newTlsExpiryDay.value)) {
    tlsExpiryDays.value.push(newTlsExpiryDay.value)
    tlsExpiryDays.value.sort((a, b) => a - b)
    newTlsExpiryDay.value = null
  }
}

function removeTlsExpiryDay(day: number) {
  tlsExpiryDays.value = tlsExpiryDays.value.filter(d => d !== day)
}

async function saveTlsExpirySettings() {
  try {
    await $fetch('/api/v1/settings/tls-expiry', { method: 'PUT', body: { days: tlsExpiryDays.value } })
    toast.add({ title: 'Success', description: 'TLS expiry settings saved', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save settings', color: 'error' })
  }
}
onMounted(async()=>{
  await fetchTlsExpirySettings()
  platformAdmin.value=!!(await $fetch<{data?:{platformAdmin?:boolean}}>('/api/auth/session')).data?.platformAdmin
  if (platformAdmin.value) await fetchOutbox()
})
// Delivery log (platform admin only)
const outbox = ref<any[]>([])
const outboxStatus = ref('')
const outboxCursor = ref<string | null>(null)
const outboxHasMore = ref(false)
const outboxLoading = ref(false)
const outboxError = ref('')

async function fetchOutbox(reset = true) {
  outboxLoading.value = true
  outboxError.value = ''
  try {
    const result = await $fetch<any>('/api/v1/notifications/outbox', {
      query: { status: outboxStatus.value || undefined, cursor: reset ? undefined : outboxCursor.value || undefined, limit: 25 },
    })
    outbox.value = reset ? (result?.data || []) : [...outbox.value, ...(result?.data || [])]
    outboxCursor.value = result?.page?.nextCursor || null
    outboxHasMore.value = !!result?.page?.hasMore
  } catch (e: any) {
    outboxError.value = e?.data?.message || 'Unable to load delivery log'
  } finally {
    outboxLoading.value = false
  }
}

</script>
<template>
<div class="space-y-8"><SettingsResourceSettings kind="notification" title="Notifications" />
<section v-if="platformAdmin" class="section-card space-y-3"><h3 class="font-semibold">TLS certificate expiry notifications</h3><p>Global notification days before expiry</p><div class="flex flex-wrap gap-2"><button v-for="day in tlsExpiryDays" class="btn btn-secondary" @click="removeTlsExpiryDay(day)">{{day}} days ×</button></div><label>Days<input v-model.number="newTlsExpiryDay" type="number" min="1" max="365" class="input-field" /></label><div class="flex gap-2"><button class="btn btn-secondary" @click="addTlsExpiryDay">Add day</button><button class="btn btn-primary" @click="saveTlsExpirySettings">Save TLS settings</button></div></section>

<section v-if="platformAdmin" class="section-card space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 class="font-semibold">{{ 'Delivery log' }}</h3>
      <p class="text-sm text-secondary">{{ 'Recent notification attempts. Payloads and integration URLs are never shown.' }}</p>
    </div>
    <div class="flex items-center gap-2">
      <select v-model="outboxStatus" class="select-field" @change="fetchOutbox()">
        <option value="">All statuses</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option><option value="dead">Failed</option>
      </select>
      <button class="btn btn-secondary" :disabled="outboxLoading" @click="fetchOutbox()">Refresh</button>
    </div>
  </div>
  <p v-if="outboxError" role="alert" class="text-sm text-red-400">{{ outboxError }}</p>
  <div class="overflow-x-auto">
    <table class="table">
      <thead><tr><th>Time</th><th>Monitor</th><th>Channel</th><th>Event</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead>
      <tbody>
        <tr v-for="row in outbox" :key="row.id">
          <td class="text-secondary">{{ row.createdAt.slice(0, 19).replace('T', ' ') }}</td>
          <td>{{ row.monitor || '—' }}</td>
          <td>{{ row.channel || '—' }}</td>
          <td class="text-secondary">{{ row.eventType }}</td>
          <td><span :class="row.status === 'dead' ? 'text-red-400' : row.status === 'delivered' ? 'text-emerald-400' : 'text-secondary'">{{ row.status }}</span></td>
          <td class="text-secondary">{{ row.attempts }}</td>
          <td class="text-secondary">{{ row.error || '—' }}</td>
        </tr>
        <tr v-if="!outbox.length && !outboxLoading"><td colspan="7" class="text-center text-secondary py-4">No delivery attempts found.</td></tr>
      </tbody>
    </table>
  </div>
  <button v-if="outboxHasMore" class="btn btn-secondary" :disabled="outboxLoading" @click="fetchOutbox(false)">Load more</button>
</section>

</div>
</template>

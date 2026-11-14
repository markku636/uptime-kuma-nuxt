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
onMounted(async()=>{await fetchTlsExpirySettings();platformAdmin.value=!!(await $fetch<{data?:{platformAdmin?:boolean}}>('/api/auth/session')).data?.platformAdmin})
</script>
<template>
<div class="space-y-8"><SettingsResourceSettings kind="notification" title="Notifications" />
<section v-if="platformAdmin" class="section-card space-y-3"><h3 class="font-semibold">TLS certificate expiry notifications</h3><p>Global notification days before expiry</p><div class="flex flex-wrap gap-2"><button v-for="day in tlsExpiryDays" class="btn btn-secondary" @click="removeTlsExpiryDay(day)">{{day}} days ×</button></div><label>Days<input v-model.number="newTlsExpiryDay" type="number" min="1" max="365" class="input-field" /></label><div class="flex gap-2"><button class="btn btn-secondary" @click="addTlsExpiryDay">Add day</button><button class="btn btn-primary" @click="saveTlsExpirySettings">Save TLS settings</button></div></section>
</div>
</template>

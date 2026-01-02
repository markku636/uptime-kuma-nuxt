<template>
  <div class="section-card">
    <h4 class="text-lg font-semibold text-white mb-4">General Settings</h4>

    <form @submit.prevent="saveSettings" class="space-y-6">
      <!-- Display Timezone -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Display Timezone</label>
        <select v-model="form.displayTimezone" class="select-field">
          <option value="auto">Auto: {{ guessTimezone }}</option>
          <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
            {{ tz.label }}
          </option>
        </select>
      </div>

      <!-- Server Timezone -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Server Timezone</label>
        <select v-model="form.serverTimezone" class="select-field">
          <option value="UTC">UTC</option>
          <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
            {{ tz.label }}
          </option>
        </select>
      </div>

      <!-- Search Engine Visibility -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Search Engine Visibility</label>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.searchEngineIndex" type="radio" name="searchEngine" :value="true" class="text-green-500" />
            <span class="text-gray-300">Allow indexing</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.searchEngineIndex" type="radio" name="searchEngine" :value="false" class="text-green-500" />
            <span class="text-gray-300">Discourage search engines from indexing site</span>
          </label>
        </div>
      </div>

      <!-- Entry Page -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Entry Page</label>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.entryPage" type="radio" name="entryPage" value="dashboard" class="text-green-500" />
            <span class="text-gray-300">Dashboard</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.entryPage" type="radio" name="entryPage" value="statusPage" class="text-green-500" />
            <span class="text-gray-300">Status Page</span>
          </label>
        </div>
      </div>

      <!-- Primary Base URL -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Primary Base URL</label>
        <div class="flex gap-2">
          <input v-model="form.primaryBaseURL" type="text" class="input-field flex-1" placeholder="https://example.com" />
          <button type="button" class="btn btn-secondary" @click="autoGetPrimaryBaseURL">Auto Get</button>
        </div>
        <p class="text-sm text-gray-500 mt-1">Used for generating links in notifications</p>
      </div>

      <!-- Keep Data Period -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Keep Data Period (days)</label>
        <input v-model.number="form.keepDataPeriodDays" type="number" class="input-field" min="1" placeholder="180" />
        <p class="text-sm text-gray-500 mt-1">Number of days to keep heartbeat data. Set to 0 to keep forever.</p>
      </div>

      <!-- Steam API Key -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Steam API Key</label>
        <input v-model="form.steamAPIKey" type="password" class="input-field" placeholder="Optional: For Steam Game Server monitoring" />
        <p class="text-sm text-gray-500 mt-1">Get your key from <a href="https://steamcommunity.com/dev/apikey" target="_blank" class="text-green-400 hover:underline">Steam</a></p>
      </div>

      <!-- DNS Servers -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">DNS Servers</label>
        <textarea v-model="form.dnsServers" class="input-field" rows="3" placeholder="8.8.8.8&#10;1.1.1.1"></textarea>
        <p class="text-sm text-gray-500 mt-1">One DNS server per line. Used for DNS monitoring.</p>
      </div>

      <!-- Submit -->
      <div class="pt-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
const toast = useToast()

const form = reactive({
  displayTimezone: 'auto',
  serverTimezone: 'UTC',
  searchEngineIndex: true,
  entryPage: 'dashboard',
  primaryBaseURL: '',
  keepDataPeriodDays: 180,
  steamAPIKey: '',
  dnsServers: ''
})

const loading = ref(false)
const guessTimezone = computed(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong' },
  { value: 'America/New_York', label: 'America/New York (Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (Pacific)' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland' }
]

const autoGetPrimaryBaseURL = () => {
  form.primaryBaseURL = window.location.origin
}

const saveSettings = async () => {
  loading.value = true
  try {
    await $fetch('/api/settings', { method: 'POST', body: form })
    toast.add({ title: 'Success', description: 'Settings saved', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save settings', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const settings = await $fetch('/api/settings')
    if (settings) Object.assign(form, settings)
  } catch (error) {}
})
</script>

<template>
  <div class="space-y-6">
    <div class="section-card">
      <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">General Settings</h4>

      <form @submit.prevent="saveSettings" class="space-y-6">
        <!-- Display Timezone -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Display Timezone</label>
          <select v-model="form.displayTimezone" class="select-field">
            <option value="auto">Auto: {{ guessTimezone }}</option>
            <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </select>
        </div>

        <!-- Server Timezone -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Server Timezone</label>
          <select v-model="form.serverTimezone" class="select-field">
            <option value="UTC">UTC</option>
            <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </select>
        </div>

        <!-- Runtime hints -->
        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.showRuntimeHints" type="checkbox" class="text-green-500" />
            <span class="text-sm text-gray-700 dark:text-gray-200">Show runtime hints (ⓘ) on Nodes and monitor pages</span>
          </label>
          <p class="text-xs text-gray-500 mt-1">When disabled, the explanation icons are hidden. Text is localized with the selected language.</p>
        </div>

        <!-- Search Engine Visibility -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Search Engine Visibility</label>
          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.searchEngineIndex" type="radio" name="searchEngine" :value="true" class="text-green-500" />
              <span class="text-gray-700 dark:text-gray-200">Allow indexing</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.searchEngineIndex" type="radio" name="searchEngine" :value="false" class="text-green-500" />
              <span class="text-gray-700 dark:text-gray-200">Discourage search engines from indexing site</span>
            </label>
          </div>
        </div>

        <p class="text-xs text-secondary mt-2">Search engine visibility, primary base URL, Steam API key, Chrome path, DNS servers, notification checks and beta flags are stored for compatibility but are not applied by this deployment.</p>

        <!-- Entry Page -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Entry Page</label>
          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.entryPage" type="radio" name="entryPage" value="dashboard" class="text-green-500" />
              <span class="text-gray-700 dark:text-gray-200">Dashboard</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.entryPage" type="radio" name="entryPage" value="status" class="text-green-500" />
              <span class="text-gray-700 dark:text-gray-200">Status Page</span>
            </label>
            <select v-if="form.entryPage === 'status'" v-model="form.statusPageSlug" aria-label="Status page" class="input-field">
              <option value="" disabled>Select a status page</option>
              <option v-for="page in statusPages" :key="page.id" :value="page.slug">{{ page.title }}</option>
            </select>
          </div>
        </div>

        <!-- Primary Base URL -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Primary Base URL</label>
          <div class="flex gap-2">
            <input v-model="form.primaryBaseURL" type="text" class="input-field flex-1" placeholder="https://example.com" />
            <button type="button" class="btn btn-secondary" @click="autoGetPrimaryBaseURL">Auto Get</button>
          </div>
          <p class="text-sm text-gray-500 mt-1">Used for generating links in notifications</p>
        </div>

        <!-- Steam API Key -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Steam API Key</label>
          <input v-model="form.steamAPIKey" type="password" class="input-field" placeholder="Optional: For Steam Game Server monitoring" />
          <p class="text-sm text-gray-500 mt-1">Get your key from <a href="https://steamcommunity.com/dev/apikey" target="_blank" class="text-green-400 hover:underline">Steam</a></p>
        </div>

        <!-- Chrome/Chromium Executable Path -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Chrome/Chromium Executable Path</label>
          <input v-model="form.chromeExecutable" type="text" class="input-field" placeholder="Leave empty for auto-detect" />
          <p class="text-sm text-gray-500 mt-1">Path to Chrome/Chromium executable for Real Browser monitors</p>
        </div>

        <!-- DNS Servers -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">DNS Servers</label>
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

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()

const form = reactive({
  displayTimezone: 'auto',
  serverTimezone: 'UTC',
  searchEngineIndex: true,
  entryPage: 'dashboard',
  primaryBaseURL: '',
  steamAPIKey: '',
  chromeExecutable: '',
  dnsServers: '',
  statusPageSlug: '',
  showRuntimeHints: true
})

const loading = ref(false)
const statusPages = ref<any[]>([])
const guessTimezone = computed(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei (UTC+8)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (UTC+9)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (UTC+8)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' },
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (UTC+7)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
  { value: 'America/New_York', label: 'America/New York (Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (Pacific)' },
  { value: 'America/Toronto', label: 'America/Toronto (Eastern)' },
  { value: 'America/Vancouver', label: 'America/Vancouver (Pacific)' },
  { value: 'America/Sao_Paulo', label: 'America/São Paulo (UTC-3)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1/+2)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (UTC+3)' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (UTC+1/+2)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+10/+11)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (UTC+10/+11)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (UTC+8)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (UTC+12/+13)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (UTC-10)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (UTC+2)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (UTC+2)' }
]

const autoGetPrimaryBaseURL = () => {
  form.primaryBaseURL = window.location.origin
}

const saveSettings = async () => {
  loading.value = true
  try {
    await $fetch('/api/settings/general', { 
      method: 'POST', 
      body: {
        displayTimezone: form.displayTimezone,
        serverTimezone: form.serverTimezone,
        searchEngineIndex: form.searchEngineIndex,
        entryPage: form.entryPage,
        primaryBaseUrl: form.primaryBaseURL,
        steamApiKey: form.steamAPIKey,
        chromePath: form.chromeExecutable,
        dnsServers: form.dnsServers,
        statusPageSlug: form.entryPage === 'status' ? form.statusPageSlug : undefined,
        showRuntimeHints: form.showRuntimeHints
      }
    })
    // Reflect the new values immediately instead of waiting for a reload.
    useState('display-timezone').value = form.displayTimezone
    useState('display-timezone-loaded').value = true
    useState('show-runtime-hints').value = form.showRuntimeHints
    useState('show-runtime-hints-loaded').value = true
    toast.add({ title: 'Success', description: 'Settings saved', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save settings', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const settings = await $fetch('/api/settings/general') as any
    if (settings) {
      form.displayTimezone = settings.displayTimezone || 'auto'
      form.serverTimezone = settings.serverTimezone || 'UTC'
      form.searchEngineIndex = settings.searchEngineIndex ?? true
      form.showRuntimeHints = settings.showRuntimeHints ?? true
      form.entryPage = settings.entryPage || 'dashboard'
      form.primaryBaseURL = settings.primaryBaseUrl || ''
      form.steamAPIKey = settings.steamApiKey || ''
      form.chromeExecutable = settings.chromePath || ''
      form.dnsServers = settings.dnsServers || '8.8.8.8\n1.1.1.1'
      form.statusPageSlug = settings.statusPageSlug || ''
    }
    const pages = await $fetch<any>('/api/v1/status-pages')
    statusPages.value = pages?.data || []
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
})
</script>

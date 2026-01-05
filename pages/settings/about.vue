<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()
const showDebugInfo = ref(false)
const checkUpdate = ref(true)
const checkBeta = ref(false)
const latestVersion = ref<string | null>(null)
const currentVersion = ref('2.0.0-nuxt')
const hasUpdate = ref(false)
const checkingUpdate = ref(false)

// Server info
const serverInfo = ref<{
  version: string
  frontendVersion: string
  latency: number
  primaryHostname: string
  serverTimezone: string
  nodeVersion: string
  platform: string
  uptimeSeconds: number
} | null>(null)

onMounted(async () => {
  await fetchServerInfo()
  if (checkUpdate.value) {
    await checkForUpdates()
  }
})

async function fetchServerInfo() {
  try {
    const info = await $fetch('/api/info') as any
    serverInfo.value = info
    currentVersion.value = info?.version || '2.0.0-nuxt'
  } catch (error) {}
}

async function checkForUpdates() {
  checkingUpdate.value = true
  try {
    const result = await $fetch('/api/check-update') as any
    latestVersion.value = result?.latestVersion || null
    hasUpdate.value = result?.hasUpdate || false
  } catch (error) {
    // Silent fail
  } finally {
    checkingUpdate.value = false
  }
}

async function saveUpdateSettings() {
  try {
    await $fetch('/api/settings', {
      method: 'POST',
      body: { checkUpdate: checkUpdate.value, checkBeta: checkBeta.value }
    })
    toast.add({ title: 'Success', description: 'Settings saved', color: 'success' })
    if (checkUpdate.value) {
      await checkForUpdates()
    }
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  return parts.length > 0 ? parts.join(' ') : '< 1m'
}
</script>

<template>
  <div class="space-y-6">
    <!-- App Info -->
    <div class="section-card">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center">
          <img src="/icon.svg" alt="Uptime Kuma" class="w-10 h-10" />
        </div>
        <div>
          <h4 class="text-2xl font-bold text-white">Uptime Kuma</h4>
          <span class="text-gray-400">A fancy self-hosted monitoring tool</span>
        </div>
      </div>

      <!-- Version Info -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="p-4 bg-gray-700 rounded-lg">
          <span class="text-sm text-gray-400 block mb-1">Version</span>
          <strong class="text-white">{{ currentVersion }}</strong>
        </div>
        <div class="p-4 bg-gray-700 rounded-lg">
          <span class="text-sm text-gray-400 block mb-1">Framework</span>
          <strong class="text-white">Nuxt 4</strong>
        </div>
        <div class="p-4 bg-gray-700 rounded-lg">
          <span class="text-sm text-gray-400 block mb-1">Database</span>
          <strong class="text-white">PostgreSQL</strong>
        </div>
        <div class="p-4 bg-gray-700 rounded-lg">
          <span class="text-sm text-gray-400 block mb-1">UI</span>
          <strong class="text-white">Nuxt UI 3</strong>
        </div>
      </div>

      <!-- Server Info -->
      <div v-if="serverInfo" class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div class="p-3 bg-gray-700/50 rounded-lg">
          <span class="text-xs text-gray-400 block">Node.js</span>
          <span class="text-white text-sm">{{ serverInfo.nodeVersion || 'N/A' }}</span>
        </div>
        <div class="p-3 bg-gray-700/50 rounded-lg">
          <span class="text-xs text-gray-400 block">Platform</span>
          <span class="text-white text-sm">{{ serverInfo.platform || 'N/A' }}</span>
        </div>
        <div class="p-3 bg-gray-700/50 rounded-lg">
          <span class="text-xs text-gray-400 block">Server Uptime</span>
          <span class="text-white text-sm">{{ serverInfo.uptimeSeconds ? formatUptime(serverInfo.uptimeSeconds) : 'N/A' }}</span>
        </div>
        <div class="p-3 bg-gray-700/50 rounded-lg">
          <span class="text-xs text-gray-400 block">Server Timezone</span>
          <span class="text-white text-sm">{{ serverInfo.serverTimezone || 'UTC' }}</span>
        </div>
        <div class="p-3 bg-gray-700/50 rounded-lg">
          <span class="text-xs text-gray-400 block">Hostname</span>
          <span class="text-white text-sm">{{ serverInfo.primaryHostname || 'N/A' }}</span>
        </div>
        <div class="p-3 bg-gray-700/50 rounded-lg">
          <span class="text-xs text-gray-400 block">Latency</span>
          <span class="text-white text-sm">{{ serverInfo.latency ? `${serverInfo.latency}ms` : 'N/A' }}</span>
        </div>
      </div>

      <!-- Update Available Alert -->
      <div v-if="hasUpdate && latestVersion" class="p-4 bg-green-500/20 border border-green-500/30 rounded-lg mb-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-400 font-medium">🎉 New version available: {{ latestVersion }}</p>
            <p class="text-gray-400 text-sm">Current: {{ currentVersion }}</p>
          </div>
          <a href="https://github.com/louislam/uptime-kuma/releases" target="_blank" class="btn btn-primary">
            View Release
          </a>
        </div>
      </div>

      <!-- Debug Info Button -->
      <button class="btn btn-secondary" @click="showDebugInfo = true">
        <UIcon name="i-heroicons-bug-ant" class="w-4 h-4 mr-2" />
        Show Debug Info
      </button>
    </div>

    <!-- Update Settings -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Update Check</h5>
      
      <div class="space-y-4">
        <label class="flex items-center gap-3 cursor-pointer">
          <input v-model="checkUpdate" type="checkbox" class="w-4 h-4 text-green-500 rounded" />
          <div>
            <span class="text-white">Check for updates</span>
            <p class="text-gray-400 text-sm">Show notification when a new version is available</p>
          </div>
        </label>
        
        <label class="flex items-center gap-3 cursor-pointer" :class="{ 'opacity-50': !checkUpdate }">
          <input v-model="checkBeta" type="checkbox" class="w-4 h-4 text-green-500 rounded" :disabled="!checkUpdate" />
          <div>
            <span class="text-white">Include beta releases</span>
            <p class="text-gray-400 text-sm">Also check for beta versions (may be unstable)</p>
          </div>
        </label>
      </div>

      <div class="flex gap-3 mt-4">
        <button class="btn btn-primary" @click="saveUpdateSettings">Save</button>
        <button class="btn btn-secondary" :disabled="checkingUpdate" @click="checkForUpdates">
          {{ checkingUpdate ? 'Checking...' : 'Check Now' }}
        </button>
      </div>
    </div>

    <!-- Links -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Links</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a href="https://github.com/louislam/uptime-kuma" target="_blank" 
           class="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
          <UIcon name="i-simple-icons-github" class="w-5 h-5 text-white" />
          <span class="text-white">GitHub Repository</span>
        </a>
        <a href="https://github.com/louislam/uptime-kuma/releases" target="_blank"
           class="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
          <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-green-400" />
          <span class="text-white">Release Notes</span>
        </a>
        <a href="https://github.com/louislam/uptime-kuma/wiki" target="_blank"
           class="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
          <UIcon name="i-heroicons-book-open" class="w-5 h-5 text-blue-400" />
          <span class="text-white">Documentation</span>
        </a>
        <a href="https://github.com/louislam/uptime-kuma/issues" target="_blank"
           class="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
          <UIcon name="i-heroicons-chat-bubble-left-right" class="w-5 h-5 text-yellow-400" />
          <span class="text-white">Report Issue</span>
        </a>
      </div>
    </div>

    <!-- Credits -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Credits</h5>
      <p class="text-gray-400 text-sm mb-4">
        Uptime Kuma is created by <a href="https://github.com/louislam" target="_blank" class="text-green-400 hover:underline">Louis Lam</a> 
        and maintained by the open source community.
      </p>
      <p class="text-gray-500 text-xs">
        This Nuxt.js edition is a community-driven migration with enhanced cluster support.
      </p>
    </div>

    <!-- Debug Info Modal -->
    <CommonDebugInfo v-model="showDebugInfo" />
  </div>
</template>

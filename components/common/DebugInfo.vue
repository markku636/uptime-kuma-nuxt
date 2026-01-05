<script setup lang="ts">
/**
 * Debug Info Panel
 * Displays system and application information for debugging purposes
 */

interface DebugData {
  version: string
  latestVersion: string | null
  isContainer: boolean
  primaryBaseURL: string
  nodeVersion: string
  databaseType: string
  databaseVersion: string
  serverTimezone: string
  serverTimezoneOffset: string
}

const props = defineProps<{
  show?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const isOpen = defineModel<boolean>('modelValue', { default: false })

const debugData = ref<DebugData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Fetch debug information
const fetchDebugInfo = async () => {
  loading.value = true
  error.value = null
  
  try {
    // In a real implementation, this would call the API
    // For now, we'll use placeholder data
    debugData.value = {
      version: '2.0.0-beta',
      latestVersion: null,
      isContainer: true,
      primaryBaseURL: window.location.origin,
      nodeVersion: 'Node.js 20.x (Nuxt 4)',
      databaseType: 'PostgreSQL',
      databaseVersion: '15.x',
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      serverTimezoneOffset: `UTC${new Date().getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(new Date().getTimezoneOffset() / 60)}`
    }
  } catch (err) {
    error.value = 'Failed to fetch debug information'
    console.error(err)
  } finally {
    loading.value = false
  }
}

// Browser info
const browserInfo = computed(() => {
  const ua = navigator.userAgent
  let browser = 'Unknown'
  let version = ''
  
  if (ua.includes('Firefox/')) {
    browser = 'Firefox'
    version = ua.match(/Firefox\/(\d+)/)?.[1] || ''
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome'
    version = ua.match(/Chrome\/(\d+)/)?.[1] || ''
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari'
    version = ua.match(/Version\/(\d+)/)?.[1] || ''
  } else if (ua.includes('Edge/')) {
    browser = 'Edge'
    version = ua.match(/Edge\/(\d+)/)?.[1] || ''
  }
  
  return `${browser} ${version}`
})

const platformInfo = computed(() => {
  return navigator.platform || 'Unknown'
})

const screenInfo = computed(() => {
  return `${window.screen.width}×${window.screen.height} (Device Pixel Ratio: ${window.devicePixelRatio})`
})

const languageInfo = computed(() => {
  return navigator.language || 'Unknown'
})

// Copy to clipboard
const copyToClipboard = async () => {
  const info = `
Uptime Kuma Debug Info
======================
Version: ${debugData.value?.version || 'N/A'}
Latest Version: ${debugData.value?.latestVersion || 'N/A'}
Is Container: ${debugData.value?.isContainer ? 'Yes' : 'No'}
Primary Base URL: ${debugData.value?.primaryBaseURL || 'N/A'}
Node Version: ${debugData.value?.nodeVersion || 'N/A'}
Database: ${debugData.value?.databaseType || 'N/A'} ${debugData.value?.databaseVersion || ''}
Server Timezone: ${debugData.value?.serverTimezone || 'N/A'} (${debugData.value?.serverTimezoneOffset || ''})

Browser: ${browserInfo.value}
Platform: ${platformInfo.value}
Screen: ${screenInfo.value}
Language: ${languageInfo.value}
User Agent: ${navigator.userAgent}
`.trim()
  
  try {
    await navigator.clipboard.writeText(info)
    alert('Debug info copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Fetch on mount
onMounted(() => {
  fetchDebugInfo()
})
</script>

<template>
  <UModal v-model:open="isOpen" :title="'Debug Info'" :description="'System and application information'">
    <template #body>
      <div class="space-y-6">
        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
          <span class="ml-2">Loading debug info...</span>
        </div>
        
        <!-- Error state -->
        <UAlert
          v-else-if="error"
          color="error"
          icon="i-heroicons-exclamation-circle"
          :title="error"
        />
        
        <!-- Debug data -->
        <template v-else-if="debugData">
          <!-- Server Info -->
          <div>
            <h3 class="text-sm font-medium text-gray-400 mb-3">Server Information</h3>
            <div class="bg-gray-800 rounded-lg p-4 space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-400">Version</span>
                <span class="font-mono">{{ debugData.version }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Latest Version</span>
                <span class="font-mono">{{ debugData.latestVersion || 'Unable to check' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Is Container</span>
                <span>{{ debugData.isContainer ? 'Yes' : 'No' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Primary Base URL</span>
                <span class="font-mono text-sm truncate max-w-[200px]">{{ debugData.primaryBaseURL }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Runtime</span>
                <span class="font-mono">{{ debugData.nodeVersion }}</span>
              </div>
            </div>
          </div>
          
          <!-- Database Info -->
          <div>
            <h3 class="text-sm font-medium text-gray-400 mb-3">Database Information</h3>
            <div class="bg-gray-800 rounded-lg p-4 space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-400">Type</span>
                <span>{{ debugData.databaseType }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Version</span>
                <span class="font-mono">{{ debugData.databaseVersion }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Timezone</span>
                <span>{{ debugData.serverTimezone }} ({{ debugData.serverTimezoneOffset }})</span>
              </div>
            </div>
          </div>
          
          <!-- Browser Info -->
          <div>
            <h3 class="text-sm font-medium text-gray-400 mb-3">Browser Information</h3>
            <div class="bg-gray-800 rounded-lg p-4 space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-400">Browser</span>
                <span>{{ browserInfo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Platform</span>
                <span>{{ platformInfo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Screen</span>
                <span class="font-mono text-sm">{{ screenInfo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Language</span>
                <span>{{ languageInfo }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
    
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-clipboard"
          @click="copyToClipboard"
        >
          Copy to Clipboard
        </UButton>
        <UButton @click="isOpen = false">
          Close
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<template>
  <div class="remote-browser-check">
    <!-- Header Info -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      class="mb-4"
    >
      <template #title>{{ $t('Remote Browser') }}</template>
      <template #description>
        {{ $t('Configure a remote browser for Real Browser monitor type') }}
      </template>
    </UAlert>

    <!-- Browser Connection Form -->
    <UCard>
      <template #header>
        <h3 class="font-medium">{{ $t('Browser Connection') }}</h3>
      </template>

      <div class="space-y-4">
        <!-- URL -->
        <UFormField :label="$t('Remote Browser URL')" required>
          <UInput
            v-model="config.url"
            placeholder="ws://localhost:3000"
            :disabled="isConnecting"
          />
          <template #hint>
            <span class="text-xs text-gray-500">
              {{ $t('WebSocket URL for the remote browser (e.g., Playwright, Puppeteer)') }}
            </span>
          </template>
        </UFormField>

        <!-- Connection Status -->
        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div 
            class="w-3 h-3 rounded-full"
            :class="connectionStatusColor"
          />
          <span class="text-sm">
            {{ connectionStatusText }}
          </span>
          
          <span v-if="lastCheckTime" class="text-xs text-gray-500 ml-auto">
            {{ $t('Last checked') }}: {{ formatTime(lastCheckTime) }}
          </span>
        </div>

        <!-- Test Connection Button -->
        <div class="flex gap-2">
          <UButton
            :loading="isConnecting"
            :disabled="!config.url"
            @click="testConnection"
          >
            <UIcon name="i-heroicons-signal" class="mr-1" />
            {{ $t('Test Connection') }}
          </UButton>
          
          <UButton
            variant="outline"
            :disabled="!config.url || isConnecting"
            @click="saveConfig"
          >
            {{ $t('Save') }}
          </UButton>
        </div>

        <!-- Error Message -->
        <UAlert
          v-if="connectionError"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          :description="connectionError"
        />

        <!-- Success Message -->
        <UAlert
          v-if="connectionSuccess"
          icon="i-heroicons-check-circle"
          color="success"
          :description="connectionSuccess"
        />
      </div>
    </UCard>

    <!-- Browser Info -->
    <UCard v-if="browserInfo" class="mt-4">
      <template #header>
        <h3 class="font-medium">{{ $t('Browser Information') }}</h3>
      </template>

      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-gray-500">{{ $t('Browser') }}:</span>
          <span class="ml-2 font-medium">{{ browserInfo.browser }}</span>
        </div>
        <div>
          <span class="text-gray-500">{{ $t('Version') }}:</span>
          <span class="ml-2 font-medium">{{ browserInfo.version }}</span>
        </div>
        <div>
          <span class="text-gray-500">{{ $t('Platform') }}:</span>
          <span class="ml-2 font-medium">{{ browserInfo.platform }}</span>
        </div>
        <div>
          <span class="text-gray-500">{{ $t('Protocol Version') }}:</span>
          <span class="ml-2 font-medium">{{ browserInfo.protocolVersion }}</span>
        </div>
      </div>
    </UCard>

    <!-- Setup Instructions -->
    <UCard class="mt-4">
      <template #header>
        <h3 class="font-medium">{{ $t('Setup Instructions') }}</h3>
      </template>

      <div class="space-y-4 text-sm">
        <p>{{ $t('To use Real Browser monitors, you need to set up a remote browser:') }}</p>
        
        <div class="p-3 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">
          # {{ $t('Using Docker') }}<br>
          docker run -d --name playwright-browser -p 3000:3000 browserless/chrome
        </div>

        <div class="p-3 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">
          # {{ $t('Using Playwright server') }}<br>
          npx playwright run-server --port 3000
        </div>

        <p class="text-gray-500">
          {{ $t('See the documentation for more setup options.') }}
        </p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
interface BrowserConfig {
  url: string
}

interface BrowserInfo {
  browser: string
  version: string
  platform: string
  protocolVersion: string
}

const { t } = useI18n()

const config = reactive<BrowserConfig>({
  url: ''
})

const isConnecting = ref(false)
const connectionError = ref('')
const connectionSuccess = ref('')
const lastCheckTime = ref<Date | null>(null)
const browserInfo = ref<BrowserInfo | null>(null)

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
const connectionStatus = ref<ConnectionStatus>('disconnected')

const connectionStatusColor = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
})

const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return t('Connected')
    case 'connecting':
      return t('Connecting...')
    case 'error':
      return t('Connection Failed')
    default:
      return t('Not Connected')
  }
})

// Fetch existing config on mount
onMounted(async () => {
  try {
    const response = await $fetch<{ url: string }>('/api/v1/settings/remote-browser')
    if (response.url) {
      config.url = response.url
    }
  } catch (e) {
    // No config saved yet
  }
})

async function testConnection() {
  if (!config.url) return

  isConnecting.value = true
  connectionError.value = ''
  connectionSuccess.value = ''
  connectionStatus.value = 'connecting'
  browserInfo.value = null

  try {
    const response = await $fetch<{ 
      success: boolean
      browserInfo?: BrowserInfo
      message?: string 
    }>('/api/v1/settings/remote-browser/test', {
      method: 'POST',
      body: { url: config.url }
    })

    if (response.success) {
      connectionStatus.value = 'connected'
      connectionSuccess.value = t('Connection successful')
      browserInfo.value = response.browserInfo || null
    } else {
      connectionStatus.value = 'error'
      connectionError.value = response.message || t('Connection failed')
    }
  } catch (error: any) {
    connectionStatus.value = 'error'
    connectionError.value = error.message || t('Connection failed')
  } finally {
    isConnecting.value = false
    lastCheckTime.value = new Date()
  }
}

async function saveConfig() {
  try {
    await $fetch('/api/v1/settings/remote-browser', {
      method: 'POST',
      body: { url: config.url }
    })
    
    connectionSuccess.value = t('Configuration saved')
    setTimeout(() => {
      connectionSuccess.value = ''
    }, 3000)
  } catch (error: any) {
    connectionError.value = error.message || t('Failed to save configuration')
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString()
}
</script>

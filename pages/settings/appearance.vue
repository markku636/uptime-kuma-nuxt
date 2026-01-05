<template>
  <div class="section-card">
    <h4 class="text-lg font-semibold text-white mb-6">Appearance</h4>

    <form @submit.prevent="saveAppearance" class="space-y-6">
      <!-- Theme -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-3">Theme</label>
        <div class="flex gap-4">
          <button v-for="t in themeOptions" :key="t.value" type="button"
            class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all"
            :class="theme === t.value ? 'border-green-500 bg-gray-700' : 'border-gray-600 hover:border-gray-500'"
            @click="theme = t.value">
            <span class="text-2xl">{{ t.icon }}</span>
            <span class="text-gray-300">{{ t.label }}</span>
          </button>
        </div>
      </div>

      <!-- Primary Color -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-3">Primary Color</label>
        <div class="flex gap-3 flex-wrap">
          <button v-for="color in colorOptions" :key="color.value" type="button"
            class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all"
            :class="primaryColor === color.value ? 'border-white scale-110' : 'border-transparent'"
            :style="{ backgroundColor: color.hex }" :title="color.label"
            @click="primaryColor = color.value">
            <svg v-if="primaryColor === color.value" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Language -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Language</label>
        <CommonLanguageSelector />
        <p class="text-xs text-gray-500 mt-1">Select your preferred language</p>
      </div>

      <!-- Uptime Display -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Uptime Display Style</label>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="uptimeDisplayStyle" type="radio" name="uptimeStyle" value="percentage" />
            <span class="text-gray-300">Percentage (99.99%)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="uptimeDisplayStyle" type="radio" name="uptimeStyle" value="nines" />
            <span class="text-gray-300">Nines (4 nines)</span>
          </label>
        </div>
      </div>

      <!-- Heartbeat Bar Style -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-3">Heartbeat Bar Style</label>
        <div class="flex gap-4">
          <button v-for="style in heartbeatBarOptions" :key="style.value" type="button"
            class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all"
            :class="heartbeatBarStyle === style.value ? 'border-green-500 bg-gray-700' : 'border-gray-600 hover:border-gray-500'"
            @click="heartbeatBarStyle = style.value">
            <span class="text-gray-300">{{ style.label }}</span>
          </button>
        </div>
      </div>

      <!-- Elapsed Time Style -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-3">Elapsed Time Style</label>
        <div class="flex gap-4 flex-wrap">
          <button v-for="style in elapsedTimeOptions" :key="style.value" type="button"
            class="flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all"
            :class="elapsedTimeStyle === style.value ? 'border-green-500 bg-gray-700' : 'border-gray-600 hover:border-gray-500'"
            @click="elapsedTimeStyle = style.value">
            <span class="text-gray-300 text-sm">{{ style.label }}</span>
          </button>
        </div>
      </div>

      <!-- Show Certificate Expiry -->
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="showCertificateExpiry" type="checkbox" />
          <span class="text-gray-300">Show Certificate Expiry Days</span>
        </label>
      </div>

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
const colorMode = useColorMode()

const theme = ref('auto')
const primaryColor = ref('green')
const language = ref('en')
const uptimeDisplayStyle = ref('percentage')
const heartbeatBarStyle = ref('normal')
const elapsedTimeStyle = ref('no-line')
const showCertificateExpiry = ref(true)
const loading = ref(false)

// Load settings on mount
onMounted(async () => {
  try {
    const settings = await $fetch('/api/settings/appearance') as any
    if (settings) {
      theme.value = settings.theme || 'auto'
      primaryColor.value = settings.primaryColor || 'green'
      uptimeDisplayStyle.value = settings.uptimeDisplayStyle || 'percentage'
      heartbeatBarStyle.value = settings.heartbeatBarStyle || 'normal'
      elapsedTimeStyle.value = settings.elapsedTimeStyle || 'no-line'
      showCertificateExpiry.value = settings.showCertificateExpiry ?? true
      
      // Apply theme
      colorMode.preference = theme.value === 'auto' ? 'system' : theme.value
    }
  } catch (error) {
    console.error('Failed to load appearance settings:', error)
  }
})

// Watch theme changes and update colorMode
watch(theme, (newTheme) => {
  colorMode.preference = newTheme === 'auto' ? 'system' : newTheme
})

const themeOptions = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'Auto', icon: '💻' }
]

const heartbeatBarOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'none', label: 'None' }
]

const elapsedTimeOptions = [
  { value: 'no-line', label: 'No Line' },
  { value: 'with-line', label: 'With Line' },
  { value: 'none', label: 'None' }
]

const colorOptions = [
  { value: 'green', label: 'Green', hex: '#5cdd8b' },
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { value: 'red', label: 'Red', hex: '#ef4444' },
  { value: 'orange', label: 'Orange', hex: '#f97316' },
  { value: 'pink', label: 'Pink', hex: '#ec4899' }
]

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' }
]

const saveAppearance = async () => {
  loading.value = true
  try {
    await $fetch('/api/settings/appearance', {
      method: 'POST',
      body: { 
        theme: theme.value, 
        primaryColor: primaryColor.value, 
        uptimeDisplayStyle: uptimeDisplayStyle.value, 
        heartbeatBarStyle: heartbeatBarStyle.value,
        elapsedTimeStyle: elapsedTimeStyle.value,
        showCertificateExpiry: showCertificateExpiry.value 
      }
    })
    toast.add({ title: 'Success', description: 'Appearance saved', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

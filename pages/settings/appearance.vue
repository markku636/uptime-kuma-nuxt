<template>
  <div class="section-card">
    <h4 class="text-lg font-semibold text-highlighted mb-6">Appearance</h4>

    <form @submit.prevent="saveAppearance" class="space-y-6">
      <!-- Theme -->
      <div>
        <label class="block text-sm font-medium text-default mb-3">Theme</label>
        <div class="flex gap-4">
          <button v-for="t in themeOptions" :key="t.value" type="button"
            class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all"
            :class="theme === t.value ? 'border-up/40 bg-accented' : 'border-accented hover:border-accented'"
            @click="setTheme(t.value)">
            <span class="text-2xl">{{ t.icon }}</span>
            <span class="text-default">{{ t.label }}</span>
          </button>
        </div>
      </div>

      <!-- Primary Color -->
      <div>
        <label class="block text-sm font-medium text-default mb-3">Primary Color</label>
        <div class="flex gap-3 flex-wrap">
          <button v-for="color in colorOptions" :key="color.value" type="button"
            class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all"
            :class="primaryColor === color.value ? 'border-inverted scale-110' : 'border-transparent'"
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
        <label class="block text-sm font-medium text-default mb-2">Language</label>
        <CommonLanguageSelector />
        <p class="text-xs text-muted mt-1">Select your preferred language</p>
      </div>

      <!-- Uptime Display -->
      <div>
        <label class="block text-sm font-medium text-default mb-2">Uptime Display Style</label>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="uptimeDisplayStyle" type="radio" name="uptimeStyle" value="percentage" />
            <span class="text-default">Percentage (99.99%)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="uptimeDisplayStyle" type="radio" name="uptimeStyle" value="nines" />
            <span class="text-default">Nines (4 nines)</span>
          </label>
        </div>
      </div>

      <!-- Heartbeat Bar Style -->
      <div>
        <label class="block text-sm font-medium text-default mb-3">Heartbeat Bar Style</label>
        <div class="flex gap-4">
          <button v-for="style in heartbeatBarOptions" :key="style.value" type="button"
            class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all"
            :class="heartbeatBarStyle === style.value ? 'border-up/40 bg-accented' : 'border-accented hover:border-accented'"
            @click="heartbeatBarStyle = style.value">
            <span class="text-default">{{ style.label }}</span>
          </button>
        </div>
      </div>

      <!-- Elapsed Time Style -->
      <div>
        <label class="block text-sm font-medium text-default mb-3">Elapsed Time Style</label>
        <div class="flex gap-4 flex-wrap">
          <button v-for="style in elapsedTimeOptions" :key="style.value" type="button"
            class="flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all"
            :class="elapsedTimeStyle === style.value ? 'border-up/40 bg-accented' : 'border-accented hover:border-accented'"
            @click="elapsedTimeStyle = style.value">
            <span class="text-default text-sm">{{ style.label }}</span>
          </button>
        </div>
      </div>

      <!-- Show Certificate Expiry -->
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="showCertificateExpiry" type="checkbox" />
          <span class="text-default">Show Certificate Expiry Days</span>
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
const { appearanceSettings, loadAppearanceSettings, saveAppearanceSettings, applyAppearance } = useAppearanceSettings()
const { locale } = useI18n()

// Local form state so users can edit without immediately persisting
const theme = ref<'light' | 'dark' | 'system'>('system')
const primaryColor = ref('green')
const language = ref('en')
const uptimeDisplayStyle = ref<'percentage' | 'nines'>('percentage')
const heartbeatBarStyle = ref<'normal' | 'bottom' | 'none'>('normal')
const elapsedTimeStyle = ref<'no-line' | 'with-line' | 'none'>('no-line')
const showCertificateExpiry = ref(true)
const loading = ref(false)

// Keep the language field aligned with the current i18n locale
watch(locale, (newLocale) => {
  language.value = newLocale as string
}, { immediate: true })

const syncFromStore = () => {
  theme.value = normalizeTheme(appearanceSettings.value.theme)
  primaryColor.value = appearanceSettings.value.primaryColor || 'green'
  language.value = appearanceSettings.value.language || 'en'
  uptimeDisplayStyle.value = appearanceSettings.value.uptimeDisplayStyle || 'percentage'
  heartbeatBarStyle.value = appearanceSettings.value.heartbeatBarStyle || 'normal'
  elapsedTimeStyle.value = appearanceSettings.value.elapsedTimeStyle || 'no-line'
  showCertificateExpiry.value = appearanceSettings.value.showCertificateExpiry ?? true
}

// Load settings on mount
onMounted(async () => {
  await loadAppearanceSettings()
  syncFromStore()
})

// Set theme and apply immediately
const setTheme = (newTheme: 'light' | 'dark' | 'system') => {
  theme.value = newTheme
  applyAppearance({ ...appearanceSettings.value, theme: newTheme })
}

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
    const result = await saveAppearanceSettings({
      theme: theme.value,
      primaryColor: primaryColor.value,
      uptimeDisplayStyle: uptimeDisplayStyle.value,
      heartbeatBarStyle: heartbeatBarStyle.value,
      elapsedTimeStyle: elapsedTimeStyle.value,
      showCertificateExpiry: showCertificateExpiry.value,
      language: language.value,
    })

    if (result.success) {
      toast.add({ title: 'Success', description: 'Appearance saved', color: 'success' })
    } else {
      toast.add({ title: 'Error', description: result.error || 'Failed to save', color: 'error' })
    }
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

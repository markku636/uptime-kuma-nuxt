// Settings composable for managing app settings
import type { Ref } from 'vue'

interface GeneralSettings {
  primaryBaseURL?: string
  checkUpdate?: boolean
  checkBeta?: boolean
  entryPage?: string
  searchEngineIndex?: boolean
  timezone?: string
  serverTimezone?: string
}

interface NotificationSettings {
  keepDataPeriodDays?: number
}

interface SecuritySettings {
  disableAuth?: boolean
  tlsExpiryNotifyDays?: number[]
}

interface AppearanceSettings {
  theme?: 'auto' | 'light' | 'dark'
  language?: string
}

interface Settings {
  general: GeneralSettings
  notification: NotificationSettings
  security: SecuritySettings
  appearance: AppearanceSettings
}

interface UseSettingsOptions {
  autoFetch?: boolean
}

export function useSettings(options: UseSettingsOptions = {}) {
  const { autoFetch = true } = options

  // State
  const settings: Ref<Settings> = ref({
    general: {},
    notification: {},
    security: {},
    appearance: {},
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isSaving = ref(false)

  // Computed
  const theme = computed(() => settings.value.appearance.theme || 'auto')
  const language = computed(() => settings.value.appearance.language || 'en')
  const primaryBaseURL = computed(() => settings.value.general.primaryBaseURL || '')

  // Methods
  async function fetchSettings() {
    try {
      isLoading.value = true
      error.value = null
      
      const data = await $fetch<Settings>('/api/v1/settings')
      settings.value = data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch settings'
      console.error('Failed to fetch settings:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(newSettings: Partial<Settings>) {
    try {
      isSaving.value = true
      error.value = null
      
      const data = await $fetch<Settings>('/api/v1/settings', {
        method: 'PATCH',
        body: newSettings
      })
      
      settings.value = data
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to update settings'
      throw e
    } finally {
      isSaving.value = false
    }
  }

  async function updateGeneralSettings(generalSettings: GeneralSettings) {
    return updateSettings({ general: { ...settings.value.general, ...generalSettings } })
  }

  async function updateNotificationSettings(notificationSettings: NotificationSettings) {
    return updateSettings({ notification: { ...settings.value.notification, ...notificationSettings } })
  }

  async function updateSecuritySettings(securitySettings: SecuritySettings) {
    return updateSettings({ security: { ...settings.value.security, ...securitySettings } })
  }

  async function updateAppearanceSettings(appearanceSettings: AppearanceSettings) {
    return updateSettings({ appearance: { ...settings.value.appearance, ...appearanceSettings } })
  }

  // Theme handling
  const colorMode = useColorMode()
  
  function setTheme(newTheme: 'auto' | 'light' | 'dark') {
    colorMode.preference = newTheme
    updateAppearanceSettings({ theme: newTheme })
  }

  // Initialize theme from settings
  watch(() => settings.value.appearance.theme, (newTheme) => {
    if (newTheme) {
      colorMode.preference = newTheme
    }
  })

  // Auto fetch on mount
  if (autoFetch) {
    onMounted(() => {
      fetchSettings()
    })
  }

  return {
    // State
    settings,
    isLoading,
    isSaving,
    error,

    // Computed
    theme,
    language,
    primaryBaseURL,

    // Methods
    fetchSettings,
    updateSettings,
    updateGeneralSettings,
    updateNotificationSettings,
    updateSecuritySettings,
    updateAppearanceSettings,
    setTheme,
  }
}

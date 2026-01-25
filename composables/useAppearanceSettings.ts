// Composable to load and apply appearance settings across the app
import { useI18n } from '#imports'

export type ThemeOption = 'light' | 'dark' | 'system' | 'auto'
export type UptimeDisplayStyle = 'percentage' | 'nines'
export type HeartbeatBarStyle = 'normal' | 'bottom' | 'none'
export type ElapsedTimeStyle = 'no-line' | 'with-line' | 'none'

export interface AppearanceSettingsState {
  theme: ThemeOption
  primaryColor: string
  uptimeDisplayStyle: UptimeDisplayStyle
  heartbeatBarStyle: HeartbeatBarStyle
  elapsedTimeStyle: ElapsedTimeStyle
  showCertificateExpiry: boolean
  language?: string
}

interface AppearanceStateWithMeta extends AppearanceSettingsState {
  loaded: boolean
  loading: boolean
  error: string | null
}

const DEFAULT_APPEARANCE: AppearanceSettingsState = {
  theme: 'system',
  primaryColor: 'green',
  uptimeDisplayStyle: 'percentage',
  heartbeatBarStyle: 'normal',
  elapsedTimeStyle: 'no-line',
  showCertificateExpiry: true,
  language: 'en',
}

const COLOR_HEX_MAP: Record<string, string> = {
  green: '#5cdd8b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  red: '#ef4444',
  orange: '#f97316',
  pink: '#ec4899',
}

function applyPrimaryColor(color: string) {
  if (!import.meta.client) return
  const hex = COLOR_HEX_MAP[color] || color || COLOR_HEX_MAP.green
  const root = document.documentElement
  root.style.setProperty('--uk-primary', hex)
  // Keep Nuxt UI primary in sync for buttons/badges
  root.style.setProperty('--color-primary-500', hex)
  root.style.setProperty('--color-primary-600', hex)
  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) {
    themeMeta.setAttribute('content', hex)
  }
}

function applyTheme(theme: ThemeOption) {
  const colorMode = useColorMode()
  colorMode.preference = theme || 'system'
}

function applyLanguage(language?: string) {
  if (!language) return
  const { locale, setLocale } = useI18n()
  if (locale.value !== language) {
    setLocale(language)
  }
}

export function useAppearanceSettings() {
  const appearanceState = useState<AppearanceStateWithMeta>('appearance-settings', () => ({
    ...DEFAULT_APPEARANCE,
    loaded: false,
    loading: false,
    error: null,
  }))

  function applyAppearance(settings: AppearanceSettingsState = appearanceState.value) {
    if (import.meta.client) {
      applyTheme(settings.theme)
      applyPrimaryColor(settings.primaryColor)
    }
    applyLanguage(settings.language)
  }

  async function loadAppearanceSettings(force = false) {
    if (appearanceState.value.loading) return appearanceState.value
    if (appearanceState.value.loaded && !force) return appearanceState.value

    appearanceState.value.loading = true
    appearanceState.value.error = null

    try {
      const data = await $fetch<Partial<AppearanceSettingsState>>('/api/settings/appearance')
      appearanceState.value = {
        ...appearanceState.value,
        ...DEFAULT_APPEARANCE,
        ...data,
        loaded: true,
        loading: false,
        error: null,
      }
      applyAppearance(appearanceState.value)
    } catch (error: any) {
      // 401s are expected on public pages; keep defaults
      appearanceState.value.error = error?.data?.message || error?.message || 'Failed to load appearance settings'
      appearanceState.value.loaded = true
      appearanceState.value.loading = false
    }

    return appearanceState.value
  }

  async function saveAppearanceSettings(partial: Partial<AppearanceSettingsState>) {
    appearanceState.value.loading = true
    appearanceState.value.error = null

    try {
      await $fetch('/api/settings/appearance', {
        method: 'POST',
        body: partial,
      })

      appearanceState.value = {
        ...appearanceState.value,
        ...partial,
        loaded: true,
        loading: false,
        error: null,
      }

      applyAppearance(appearanceState.value)
      return { success: true }
    } catch (error: any) {
      appearanceState.value.error = error?.data?.message || error?.message || 'Failed to save appearance settings'
      appearanceState.value.loading = false
      return { success: false, error: appearanceState.value.error }
    }
  }

  return {
    appearanceState,
    appearanceSettings: computed(() => appearanceState.value as AppearanceSettingsState),
    loadAppearanceSettings,
    saveAppearanceSettings,
    applyAppearance,
  }
}

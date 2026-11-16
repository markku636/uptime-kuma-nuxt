// Composable to load and apply appearance settings across the app
import { useI18n } from '#imports'

/** 'auto' is accepted for settings saved by older versions */
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

// Appearance "primary colour" option -> Nuxt UI palette name (see app.config.ts)
const PRIMARY_PALETTE: Record<string, string> = {
  green: 'kuma',
  blue: 'blue',
  purple: 'violet',
  red: 'red',
  orange: 'orange',
  pink: 'pink',
}

function applyPrimaryColor(color: string) {
  const appConfig = useAppConfig()
  appConfig.ui.colors.primary = PRIMARY_PALETTE[color] || PRIMARY_PALETTE.green
}

/** 'auto' is the legacy name for 'system' */
export function normalizeTheme(theme?: string | null): 'light' | 'dark' | 'system' {
  return theme === 'light' || theme === 'dark' ? theme : 'system'
}

function applyTheme(theme: ThemeOption) {
  const colorMode = useColorMode()
  colorMode.preference = normalizeTheme(theme)
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
    applyPrimaryColor(settings.primaryColor)
    if (import.meta.client) {
      applyTheme(settings.theme)
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

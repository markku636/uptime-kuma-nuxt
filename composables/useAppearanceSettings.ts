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

const ACCENT_VARS = ['--uk-primary', '--uk-primary-hover', '--uk-primary-text', '--uk-on-primary', '--uk-primary-soft']

// Presets resolve to per-theme shades in main.css (html[data-accent]); only a custom hex is set inline.
function applyPrimaryColor(color: string) {
  if (!import.meta.client) return
  const hex = COLOR_HEX_MAP[color] || color || COLOR_HEX_MAP.green
  const root = document.documentElement
  for (const name of ['--color-primary-500', '--color-primary-600', ...ACCENT_VARS]) root.style.removeProperty(name)
  if (COLOR_HEX_MAP[color]) {
    root.dataset.accent = color
  } else if (/^#[0-9a-f]{6}$/i.test(hex)) {
    delete root.dataset.accent
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    const light = 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.18
    root.style.setProperty('--uk-primary', hex)
    root.style.setProperty('--uk-primary-hover', hex)
    root.style.setProperty('--uk-primary-text', hex)
    root.style.setProperty('--uk-on-primary', light ? '#020b05' : '#ffffff')
    root.style.setProperty('--uk-primary-soft', hex + '24')
  }
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

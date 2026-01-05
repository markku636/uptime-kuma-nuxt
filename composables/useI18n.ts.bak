// composables/useI18n.ts
import en from '~/locales/en.json'
import zhTW from '~/locales/zh-TW.json'
import zhCN from '~/locales/zh-CN.json'

const messages: Record<string, any> = {
  en,
  'zh-TW': zhTW,
  'zh-CN': zhCN
}

const currentLocale = ref('en')

export function useI18n() {
  const locale = computed({
    get: () => currentLocale.value,
    set: (value: string) => {
      currentLocale.value = value
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('locale', value)
      }
    }
  })

  const availableLocales = [
    { code: 'en', name: 'English' },
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'zh-CN', name: '简体中文' }
  ]

  // Initialize locale from localStorage
  onMounted(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale')
      if (savedLocale && messages[savedLocale]) {
        currentLocale.value = savedLocale
      } else {
        // Try to detect browser language
        const browserLang = navigator.language
        if (browserLang.startsWith('zh')) {
          currentLocale.value = browserLang.includes('TW') || browserLang.includes('HK') ? 'zh-TW' : 'zh-CN'
        }
      }
    }
  })

  // Translation function
  function t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.')
    let value: any = messages[currentLocale.value]

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        // Fallback to English
        value = undefined
        break
      }
    }

    // Fallback to English if not found
    if (value === undefined) {
      value = messages.en
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k]
        } else {
          value = key // Return key if not found
          break
        }
      }
    }

    // Replace parameters
    if (typeof value === 'string' && params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
      }
    }

    return typeof value === 'string' ? value : key
  }

  return {
    locale,
    availableLocales,
    t,
    setLocale: (code: string) => {
      locale.value = code
    }
  }
}

// Export a global instance for use in templates
export const i18n = {
  t: (key: string, params?: Record<string, any>) => {
    const keys = key.split('.')
    let value: any = messages[currentLocale.value]

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        value = undefined
        break
      }
    }

    if (value === undefined) {
      value = messages.en
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k]
        } else {
          value = key
          break
        }
      }
    }

    if (typeof value === 'string' && params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
      }
    }

    return typeof value === 'string' ? value : key
  }
}

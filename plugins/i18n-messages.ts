import en from '~/locales/en.json'
import zhTW from '~/locales/zh-TW.json'
import zhCN from '~/locales/zh-CN.json'
import ja from '~/locales/ja.json'

/**
 * Nuxt i18n currently ships an empty messages bundle in the production build
 * (locale files are listed as langDir but no files are registered). Register
 * the most used locales explicitly so $t() resolves instead of echoing keys.
 * Other locales keep the English fallback.
 */
const messages: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  'zh-TW': zhTW as Record<string, string>,
  'zh-CN': zhCN as Record<string, string>,
  ja: ja as Record<string, string>,
}

export default defineNuxtPlugin(nuxtApp => {
  const i18n = (nuxtApp as any).$i18n
  if (!i18n || typeof i18n.mergeLocaleMessage !== 'function') return
  for (const [code, values] of Object.entries(messages)) {
    i18n.mergeLocaleMessage(code, values)
  }
})

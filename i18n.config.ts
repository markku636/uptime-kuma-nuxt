// @ts-nocheck — @nuxtjs/i18n generic over 70 locales blows up TS instantiation
export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  // Messages are registered by plugins/i18n-messages.ts, which keeps the
  // production bundle small and avoids a deeply-inferred messages object.
}))

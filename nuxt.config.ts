// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/ui',
    '@nuxt/icon',
    '@pinia/nuxt',
    'nuxt-auth-utils',
  ],

  // Color mode configuration
  colorMode: {
    preference: 'dark', // default value
    fallback: 'dark',
    classSuffix: '',
    storageKey: 'nuxt-color-mode',
  },

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    databaseUrl: process.env.DATABASE_URL,
    session: {
      // Used by nuxt-auth-utils for signing cookies
      password: process.env.NUXT_SESSION_PASSWORD || 'change-this-session-password-at-least-32-chars-long',
    },
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
    }
  },

  nitro: {
    experimental: {
      tasks: true,
    },
  },

  typescript: {
    strict: false,
    typeCheck: false,
  },
})

import { defineConfig } from 'vitest/config'

// Unit tests for pure modules only (no Nuxt runtime)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
// The `dark` class on <html> is managed by @nuxtjs/color-mode (classSuffix: '').
const colorMode = useColorMode()

// Browser chrome colour follows the page background (tokens: --uk-bg-app)
const themeColor = computed(() => (colorMode.value === 'dark' ? '#090c10' : '#f7f9fc'))

useHead({
  title: 'Uptime Kuma',
  meta: [
    { name: 'description', content: 'A fancy self-hosted monitoring tool' },
    { name: 'theme-color', content: themeColor },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Uptime Kuma' },
    { name: 'msapplication-TileColor', content: '#5cdd8b' },
    { name: 'msapplication-config', content: '/browserconfig.xml' }
  ],
  link: [
    { rel: 'manifest', href: '/manifest.json' },
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/icon-192.png' }
  ]
})
</script>

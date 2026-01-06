<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// App entry point
const colorMode = useColorMode()

// Compute if dark mode is active
const isDark = computed(() => {
  return colorMode.value === 'dark'
})

// Apply dark class to html element when color mode changes
watch(isDark, (dark) => {
  if (import.meta.client) {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
}, { immediate: true })

// Also apply on mount
onMounted(() => {
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})

// PWA meta tags
useHead({
  title: 'Uptime Kuma',
  meta: [
    { name: 'description', content: 'A fancy self-hosted monitoring tool' },
    { name: 'theme-color', content: '#10b981' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Uptime Kuma' },
    { name: 'msapplication-TileColor', content: '#10b981' },
    { name: 'msapplication-config', content: '/browserconfig.xml' }
  ],
  link: [
    { rel: 'manifest', href: '/manifest.json' },
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/icon-192.png' }
  ]
})
</script>

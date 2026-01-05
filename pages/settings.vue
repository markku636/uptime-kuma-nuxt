<template>
  <div class="settings-page">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white">Settings</h1>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Settings Sidebar -->
      <div class="w-full lg:w-64 flex-shrink-0">
        <div class="bg-gray-800 rounded-xl p-4 sticky top-20">
          <nav class="space-y-1">
            <NuxtLink
              v-for="item in settingsNav"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-all"
              :class="{ 'bg-green-500/20 text-green-400 border-l-4 border-green-500': isActive(item.to) }"
            >
              <UIcon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
        </div>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 min-w-0">
        <div class="bg-gray-800 rounded-xl">
          <!-- Content Header -->
          <div v-if="currentPageTitle" class="px-6 py-4 border-b border-gray-700">
            <h2 class="text-xl font-semibold text-white">{{ currentPageTitle }}</h2>
          </div>
          
          <!-- Content Body -->
          <div class="p-6">
            <NuxtPage />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()

const settingsNav = [
  { label: 'Profile', to: '/settings/profile', icon: 'i-heroicons-user-circle' },
  { label: 'General', to: '/settings/general', icon: 'i-heroicons-cog-6-tooth' },
  { label: 'Appearance', to: '/settings/appearance', icon: 'i-heroicons-paint-brush' },
  { label: 'Notifications', to: '/settings/notifications', icon: 'i-heroicons-bell' },
  { label: 'Reverse Proxy', to: '/settings/reverse-proxy', icon: 'i-heroicons-cloud' },
  { label: 'Security', to: '/settings/security', icon: 'i-heroicons-shield-check' },
  { label: 'Tags', to: '/settings/tags', icon: 'i-heroicons-tag' },
  { label: 'Monitor History', to: '/settings/monitor-history', icon: 'i-heroicons-clock' },
  { label: 'Proxies', to: '/settings/proxies', icon: 'i-heroicons-server' },
  { label: 'Docker Hosts', to: '/settings/docker-hosts', icon: 'i-heroicons-cube' },
  { label: 'Remote Browsers', to: '/settings/remote-browsers', icon: 'i-heroicons-globe-alt' },
  { label: 'API Keys', to: '/settings/api-keys', icon: 'i-heroicons-key' },
  { label: 'Backup / Restore', to: '/settings/backup', icon: 'i-heroicons-arrow-down-tray' },
  { label: 'About', to: '/settings/about', icon: 'i-heroicons-information-circle' },
]

onMounted(() => {
  // Redirect to general if accessing /settings directly
  if (route.path === '/settings' || route.path === '/settings/') {
    router.push('/settings/general')
  }
})

const currentPageTitle = computed(() => {
  const item = settingsNav.find(i => i.to === route.path)
  return item?.label || ''
})

const isActive = (path: string) => route.path === path
</script>

<style scoped>
.settings-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem;
}

@media (max-width: 1024px) {
  .settings-page {
    padding: 1rem;
  }
}
</style>

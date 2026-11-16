<template>
  <div class="settings-page">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-highlighted">{{ $t('Settings') }}</h1>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Settings Sidebar -->
      <div class="w-full lg:w-64 flex-shrink-0">
        <div class="settings-sidebar">
          <nav class="space-y-1">
            <NuxtLink
              v-for="item in settingsNav"
              :key="item.to"
              :to="item.to"
              class="settings-nav-item"
              :class="{ 'settings-nav-item-active': isActive(item.to) }"
            >
              <UIcon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
              <span>{{ $t(item.label) }}</span>
            </NuxtLink>
          </nav>
        </div>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 min-w-0">
        <div class="settings-content">
          <!-- Content Header -->
          <div v-if="currentPageTitle" class="settings-content-header">
            <h2 class="text-xl font-semibold text-highlighted">{{ $t(currentPageTitle) }}</h2>
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
  { label: 'Workspaces & Groups', to: '/settings/workspaces', icon: 'i-heroicons-rectangle-group' },
  { label: 'Tags', to: '/settings/tags', icon: 'i-heroicons-tag' },
  { label: 'Monitor History', to: '/settings/monitor-history', icon: 'i-heroicons-clock' },
  { label: 'Nodes', to: '/settings/nodes', icon: 'i-heroicons-server-stack' },
  { label: 'Proxies', to: '/settings/proxies', icon: 'i-heroicons-server' },
  { label: 'Docker Hosts', to: '/settings/docker-hosts', icon: 'i-heroicons-cube' },
  { label: 'Remote Browsers', to: '/settings/remote-browsers', icon: 'i-heroicons-globe-alt' },
  { label: 'API Keys', to: '/settings/api-keys', icon: 'i-heroicons-key' },
  { label: 'Backup', to: '/settings/backup', icon: 'i-heroicons-arrow-down-tray' },
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

.settings-sidebar {
  background-color: var(--uk-bg-raised);
  border-radius: 0.75rem;
  padding: 1rem;
  position: sticky;
  top: 5rem;
  border: 1px solid var(--uk-border);
  box-shadow: 0 12px 24px -12px var(--shadow-color);
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  color: var(--uk-text-secondary);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.settings-nav-item:hover {
  color: var(--uk-text);
  background-color: var(--uk-bg-hover);
}

.settings-nav-item-active,
.settings-nav-item-active:hover {
  background-color: color-mix(in srgb, var(--uk-primary) 14%, transparent);
  color: var(--uk-primary-fg);
  border-color: color-mix(in srgb, var(--uk-primary) 35%, transparent);
  font-weight: 600;
}

.settings-content {
  background-color: var(--uk-bg-surface);
  border-radius: 0.75rem;
  border: 1px solid var(--uk-border);
  box-shadow: 0 12px 24px -12px var(--shadow-color);
}

.settings-content-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--uk-border);
}

@media (max-width: 1024px) {
  .settings-page {
    padding: 1rem;
  }
}
</style>

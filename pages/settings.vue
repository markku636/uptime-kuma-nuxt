<template>
  <div class="settings-page">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-primary">Settings</h1>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
      <label class="lg:hidden block text-sm">Settings section<select aria-label="Settings section" class="form-control mt-2" v-model="selectedSettingsPage"><option v-for="item in settingsNav" :key="item.to" :value="item.to">{{item.label}}</option></select></label>
      <!-- Settings Sidebar -->
      <div class="hidden lg:block lg:w-72 flex-shrink-0">
        <div class="settings-sidebar">
          <label class="settings-search">
            <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 opacity-60" />
            <input v-model="navSearch" type="search" :placeholder="'Find a setting…'" aria-label="Find a setting" />
          </label>
          <div v-for="group in visibleGroups" :key="group.label" class="settings-group">
            <p class="settings-group-label">{{ group.label }}</p>
            <nav class="space-y-1">
              <NuxtLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="settings-nav-item"
                :class="{ 'settings-nav-item-active': isActive(item.to) }"
              >
                <UIcon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </nav>
          </div>
          <p v-if="!visibleGroups.length" class="text-xs text-secondary px-3 py-4">{{ 'No matching settings.' }}</p>
        </div>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 min-w-0">
        <div class="settings-content">
          <!-- Content Header -->
          <div v-if="currentPageTitle" class="settings-content-header">
            <div class="flex items-center gap-2 text-sm text-secondary">
              <NuxtLink to="/settings/general" class="hover:text-primary">Settings</NuxtLink>
              <span>/</span>
              <span class="text-primary font-medium">{{ currentPageTitle }}</span>
            </div>
            <h2 class="text-xl font-semibold text-primary mt-1">{{ currentPageTitle }}</h2>
          </div>
          
          <!-- Content Body -->
          <div class="p-4 sm:p-6">
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
const selectedSettingsPage = computed({get:()=>route.path,set:(value:string)=>{void router.push(value)}})

const navSearch = ref('')

const settingsNav = [
  { label: 'Bruno', to: '/settings/bruno', icon: 'i-heroicons-arrow-path-rounded-square' },
  { label: 'Workspaces', to: '/settings/workspaces', icon: 'i-heroicons-building-office-2' },
  { label: 'Profile', to: '/settings/profile', icon: 'i-heroicons-user-circle' },
  { label: 'General', to: '/settings/general', icon: 'i-heroicons-cog-6-tooth' },
  { label: 'Appearance', to: '/settings/appearance', icon: 'i-heroicons-paint-brush' },
  { label: 'Notifications', to: '/settings/notifications', icon: 'i-heroicons-bell' },
  { label: 'Reverse Proxy', to: '/settings/reverse-proxy', icon: 'i-heroicons-cloud' },
  { label: 'Security', to: '/settings/security', icon: 'i-heroicons-shield-check' },
  { label: 'Tags', to: '/settings/tags', icon: 'i-heroicons-tag' },
  { label: 'Monitor History', to: '/settings/monitor-history', icon: 'i-heroicons-clock' },
  { label: 'Nodes', to: '/settings/nodes', icon: 'i-heroicons-server-stack' },
  { label: 'Proxies', to: '/settings/proxies', icon: 'i-heroicons-server' },
  { label: 'Docker Hosts', to: '/settings/docker-hosts', icon: 'i-heroicons-cube' },
  { label: 'Remote Browsers', to: '/settings/remote-browsers', icon: 'i-heroicons-globe-alt' },
  { label: 'Variables & Keys', to: '/settings/secrets', icon: 'i-heroicons-key' },
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

const navGroups = [
  { label: 'Monitoring', keys: ['/settings/bruno', '/settings/tags', '/settings/monitor-history', '/settings/nodes', '/settings/proxies', '/settings/docker-hosts', '/settings/remote-browsers'] },
  { label: 'Workspace', keys: ['/settings/workspaces', '/settings/notifications', '/settings/reverse-proxy'] },
  { label: 'Account & access', keys: ['/settings/profile', '/settings/security', '/settings/api-keys'] },
  { label: 'Preferences', keys: ['/settings/general', '/settings/appearance'] },
  { label: 'System', keys: ['/settings/backup', '/settings/about'] },
]
const visibleGroups = computed(() => {
  const query = navSearch.value.trim().toLowerCase()
  return navGroups
    .map(group => ({
      label: group.label,
      items: settingsNav.filter(item => group.keys.includes(item.to) && (!query || item.label.toLowerCase().includes(query))),
    }))
    .filter(group => group.items.length)
})

const currentPageTitle = computed(() => {
  const item = settingsNav.find(i => i.to === route.path)
  return item?.label || ''
})

const isActive = (path: string) => route.path === path
</script>

<style scoped>
.settings-page {
  width: 100%;
  padding: 1.5rem;
}

.settings-sidebar {
  background-color: var(--bg-tertiary);
  border-radius: 0.75rem;
  padding: 1rem;
  position: sticky;
  top: 5rem;
  border: 1px solid var(--border-color);
  box-shadow: 0 12px 24px -12px var(--shadow-color);
}

.settings-group { margin-bottom: 1rem; }
.settings-group-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  padding: 0.25rem 1rem 0.35rem;
  font-weight: 600;
}
.settings-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
}
.settings-search input {
  width: 100%;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--text-primary);
  font-size: 0.875rem;
}
.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.settings-nav-item:hover {
  color: var(--text-primary);
  background-color: var(--hover-bg);
}

.settings-nav-item-active {
  background-color: var(--uk-primary-soft);
  color: var(--uk-primary-text) !important;
  border-color: var(--uk-primary-soft);
}

.settings-content {
  background-color: var(--bg-secondary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  box-shadow: 0 12px 24px -12px var(--shadow-color);
}

.settings-content-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

@media (max-width: 1024px) {
  .settings-page {
    padding: 1rem;
  }
}
</style>

<style scoped>
@media(max-width:639px){.settings-page{padding:0}}
</style>

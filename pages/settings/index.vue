<template>
  <div class="page-container">
    <h1 v-show="!isMobile || !currentSubPage" class="text-2xl font-bold text-white mb-6">Settings</h1>

    <div class="card">
      <div class="flex flex-col md:flex-row">
        <!-- Settings Menu -->
        <div v-if="showSubMenu" class="w-full md:w-64 border-r border-gray-700">
          <nav class="p-4 space-y-1">
            <NuxtLink
              v-for="item in settingsNav"
              :key="item.to"
              :to="item.to"
              class="block px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              :class="{ 'bg-gray-700 text-green-400': isActive(item.to) }"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <!-- Settings Content -->
        <div class="flex-1 p-6">
          <div v-if="currentSubPage" class="text-lg font-semibold text-white mb-4 pb-4 border-b border-gray-700">
            {{ currentPageTitle }}
          </div>
          <div class="text-gray-300">
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
  { label: 'General', to: '/settings/general' },
  { label: 'Appearance', to: '/settings/appearance' },
  { label: 'Notifications', to: '/settings/notifications' },
  { label: 'Security', to: '/settings/security' },
  { label: 'Tags', to: '/settings/tags' },
  { label: 'Monitor History', to: '/settings/monitor-history' },
  { label: 'Proxies', to: '/settings/proxies' },
  { label: 'Docker Hosts', to: '/settings/docker-hosts' },
  { label: 'Remote Browsers', to: '/settings/remote-browsers' },
  { label: 'API Keys', to: '/settings/api-keys' },
  { label: 'Backup / Restore', to: '/settings/backup' },
  { label: 'About', to: '/settings/about' },
]

const isMobile = ref(false)

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  if (!currentSubPage.value && !isMobile.value) {
    router.push('/settings/general')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const currentSubPage = computed(() => {
  const pathParts = route.path.split('/')
  const lastPart = pathParts[pathParts.length - 1]
  if (lastPart === 'settings') return null
  return lastPart
})

const currentPageTitle = computed(() => {
  const item = settingsNav.find(i => i.to === route.path)
  return item?.label || ''
})

const showSubMenu = computed(() => {
  if (isMobile.value) {
    return !currentSubPage.value
  }
  return true
})

const isActive = (path: string) => route.path === path
</script>

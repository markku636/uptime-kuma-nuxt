<template>
  <div class="layout-root">
    <!-- Header -->
    <header class="header-main">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 gap-4">
          <!-- Logo -->
          <NuxtLink to="/dashboard" class="flex shrink-0 items-center gap-2 text-highlighted hover:no-underline">
            <img src="/icon.svg" alt="" class="h-8 w-8" />
            <span class="text-xl font-bold">Uptime Kuma</span>
          </NuxtLink>

          <!-- Navigation -->
          <nav class="hidden lg:flex items-center gap-1" :aria-label="t('Toggle navigation')">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              active-class="nav-link-active"
            >
              <UIcon :name="item.icon" class="size-4" />
              {{ item.label }}
              <span
                v-if="item.badge"
                class="ml-0.5 rounded-full bg-maintenance px-1.5 text-[11px] font-semibold leading-5 text-white"
                :title="t('activeMaintenanceCount', { n: item.badge })"
              >
                {{ item.badge }}
              </span>
            </NuxtLink>
          </nav>

          <!-- Right side -->
          <div class="flex items-center gap-1 sm:gap-2">
            <!-- Node Selector (Cluster Mode) -->
            <CommonNodeSelector />

            <!-- Theme -->
            <UDropdownMenu :items="themeMenuItems" :content="{ align: 'end' }">
              <button class="header-icon-btn" :title="t('Theme')" :aria-label="t('Theme')">
                <UIcon :name="themeIcon" class="size-5" />
              </button>
            </UDropdownMenu>

            <!-- Keyboard shortcuts help -->
            <button
              class="header-icon-btn hidden sm:inline-flex"
              :title="`${t('Keyboard Shortcuts')} (Ctrl+/)`"
              :aria-label="t('Keyboard Shortcuts')"
              @click="showShortcutsHelp = true"
            >
              <UIcon name="i-heroicons-question-mark-circle" class="size-5" />
            </button>

            <!-- Profile dropdown -->
            <UDropdownMenu :items="profileMenuItems" :content="{ align: 'end' }">
              <button class="header-icon-btn" :aria-label="t('Profile')">
                <span class="flex size-8 items-center justify-center rounded-full bg-elevated">
                  <UIcon name="i-heroicons-user" class="size-5" />
                </span>
              </button>
            </UDropdownMenu>

            <!-- Mobile menu button -->
            <button
              class="lg:hidden header-icon-btn"
              :aria-label="t('Toggle navigation')"
              :aria-expanded="mobileMenuOpen"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <UIcon :name="mobileMenuOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'" class="size-6" />
            </button>
          </div>
        </div>

        <!-- Mobile menu -->
        <nav v-if="mobileMenuOpen" class="lg:hidden flex flex-col gap-1 border-t border-default py-3">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            active-class="nav-link-active"
            @click="mobileMenuOpen = false"
          >
            <UIcon :name="item.icon" class="size-4" />
            {{ item.label }}
            <span v-if="item.badge" class="ml-auto rounded-full bg-maintenance px-1.5 text-[11px] font-semibold leading-5 text-white">
              {{ item.badge }}
            </span>
          </NuxtLink>
        </nav>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>

    <!-- Keyboard shortcuts help modal -->
    <CommonKeyboardShortcutsHelp v-model="showShortcutsHelp" />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()
const route = useRoute()
const mobileMenuOpen = ref(false)
const { clear } = useUserSession()

// Active maintenance count for the nav badge (refreshed on navigation)
const { activeCount, fetchMaintenances } = useMaintenances({ live: false })
watch(() => route.path, (path, old) => {
  if (old && path !== old) fetchMaintenances()
})

const navItems = computed(() => [
  { to: '/dashboard', label: t('Dashboard'), icon: 'i-heroicons-squares-2x2' },
  { to: '/monitors', label: t('Monitors'), icon: 'i-heroicons-signal' },
  { to: '/maintenance', label: t('Maintenance'), icon: 'i-heroicons-wrench-screwdriver', badge: activeCount.value || 0 },
  { to: '/status-pages', label: t('Status Pages'), icon: 'i-heroicons-globe-alt' },
  { to: '/settings', label: t('Settings'), icon: 'i-heroicons-cog-6-tooth' },
  { to: '/api-docs', label: t('API Docs'), icon: 'i-heroicons-code-bracket' },
])

// Theme: light / dark / follow the system
const themeIcon = computed(() => {
  if (colorMode.preference === 'system') return 'i-heroicons-computer-desktop'
  return colorMode.value === 'dark' ? 'i-heroicons-moon' : 'i-heroicons-sun'
})

const themeMenuItems = computed(() => [
  [
    { label: t('Light'), icon: 'i-heroicons-sun', value: 'light' },
    { label: t('Dark'), icon: 'i-heroicons-moon', value: 'dark' },
    { label: t('Auto'), icon: 'i-heroicons-computer-desktop', value: 'system' },
  ].map(option => ({
    label: option.label,
    icon: option.icon,
    type: 'checkbox' as const,
    checked: colorMode.preference === option.value,
    onSelect: () => { colorMode.preference = option.value },
    onUpdateChecked: () => { colorMode.preference = option.value },
  })),
])

// Use shared keyboard shortcuts state
const { showHelp } = useKeyboardShortcuts()
const showShortcutsHelp = showHelp

const profileMenuItems = computed(() => [
  [
    { label: t('Profile'), icon: 'i-heroicons-user', to: '/settings/profile' },
    { label: t('Settings'), icon: 'i-heroicons-cog-6-tooth', to: '/settings' },
  ],
  [
    { label: t('Logout'), icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: handleLogout },
  ],
])

// Logout handler
async function handleLogout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // ignore
  }
  await clear()
  // Force a full page reload to clear all state
  window.location.replace('/login')
}
</script>

<style scoped>
.layout-root {
  min-height: 100vh;
  background-color: var(--uk-bg-app);
  color: var(--uk-text);
}

.header-main {
  position: sticky;
  top: 0;
  z-index: var(--uk-z-header);
  background-color: color-mix(in srgb, var(--uk-bg-surface) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(8px);
  border-bottom: 1px solid var(--uk-border);
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: var(--uk-radius-sm);
  color: var(--uk-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  transition: color var(--uk-duration-fast) ease, background-color var(--uk-duration-fast) ease;
}

.nav-link:hover {
  color: var(--uk-text);
  background-color: var(--uk-bg-hover);
  text-decoration: none;
}

.nav-link-active,
.nav-link-active:hover {
  color: var(--uk-primary-fg);
  background-color: color-mix(in srgb, var(--uk-primary) 14%, transparent);
}

.header-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border-radius: var(--uk-radius-sm);
  color: var(--uk-text-muted);
  transition: color var(--uk-duration-fast) ease, background-color var(--uk-duration-fast) ease;
}

.header-icon-btn:hover {
  color: var(--uk-text);
  background-color: var(--uk-bg-hover);
}
</style>

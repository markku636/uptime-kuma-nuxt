<template>
  <div class="layout-root lg:pl-60">
    <!-- Desktop sidebar -->
    <aside class="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-default bg-[var(--bg-secondary)] z-40">
      <NuxtLink to="/dashboard" class="h-16 flex items-center gap-2 px-5 text-primary shrink-0">
        <img src="/sealwatch-sidebar.png" alt="SealWatch" class="h-8 w-auto" />
      </NuxtLink>
      <nav class="flex-1 px-3 py-4 space-y-1 text-sm">
        <NuxtLink to="/dashboard" class="sidebar-link" active-class="sidebar-link-active"><UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 shrink-0 opacity-70" />
          <span>Dashboard</span>
        </NuxtLink>
        <NuxtLink to="/monitors" class="sidebar-link" :class="{ 'sidebar-link-active': monitorsActive }"><UIcon name="i-heroicons-server" class="w-4 h-4 shrink-0 opacity-70" />
          <span>Monitors</span>
        </NuxtLink>
        <NuxtLink to="/monitors/groups" class="sidebar-link" active-class="sidebar-link-active"><UIcon name="i-heroicons-folder" class="w-4 h-4 shrink-0 opacity-70" />
          <span>Groups</span>
        </NuxtLink>
        <NuxtLink to="/maintenance" class="sidebar-link" active-class="sidebar-link-active"><UIcon name="i-heroicons-wrench-screwdriver" class="w-4 h-4 shrink-0 opacity-70" />
          <span>Maintenance</span>
        </NuxtLink>
        <NuxtLink to="/reports" class="sidebar-link" active-class="sidebar-link-active"><UIcon name="i-heroicons-chart-bar" class="w-4 h-4 shrink-0 opacity-70" />
          <span>Reports</span>
        </NuxtLink>
        <NuxtLink to="/settings" class="sidebar-link" active-class="sidebar-link-active"><UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4 shrink-0 opacity-70" />
          <span>Settings</span>
        </NuxtLink>
        <NuxtLink to="/status-pages" class="sidebar-link" active-class="sidebar-link-active"><UIcon name="i-heroicons-globe-alt" class="w-4 h-4 shrink-0 opacity-70" />
          <span>Status Pages</span>
        </NuxtLink>
        <NuxtLink to="/api-docs" class="sidebar-link" active-class="sidebar-link-active"><UIcon name="i-heroicons-book-open" class="w-4 h-4 shrink-0 opacity-70" />
          <span>API Docs</span>
        </NuxtLink>
      </nav>
      <div class="px-5 py-4 text-xs text-tertiary border-t border-default">Monitor · Alert · Status</div>
    </aside>

    <!-- Header -->
    <header class="header-main border-b border-default bg-[var(--bg-secondary)]">
      <div class="w-full max-w-[1600px] mr-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/dashboard" class="lg:hidden flex items-center gap-2 shrink-0 text-primary hover:text-emerald-500 transition-colors">
            <img src="/sealwatch-sidebar.png" alt="SealWatch" class="h-8 w-auto" />
          </NuxtLink>

          <!-- Navigation -->
          <nav class="hidden">
            <NuxtLink
              to="/dashboard"
              class="nav-link"
              active-class="nav-link-active"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/monitors"
              class="nav-link"
              :class="{ 'nav-link-active': monitorsActive }"
            >
              Monitors
            </NuxtLink>
            <NuxtLink
              to="/monitors/groups"
              class="nav-link"
              active-class="nav-link-active"
            >
              Groups
            </NuxtLink>
            <NuxtLink
              to="/maintenance"
              class="nav-link"
              active-class="nav-link-active"
            >
              Maintenance
            </NuxtLink>
            <NuxtLink
              to="/settings"
              class="nav-link"
              active-class="nav-link-active"
            >
              Settings
            </NuxtLink>
            <NuxtLink
              to="/status-pages"
              class="nav-link"
              active-class="nav-link-active"
            >
              Status Pages
            </NuxtLink>
            <NuxtLink
              to="/api-docs"
              class="nav-link"
              active-class="nav-link-active"
            >
              API Docs
            </NuxtLink>
          </nav>


          <!-- Right side -->
          <div class="flex items-center gap-1 sm:gap-3 ml-auto">
            <!-- Node Selector (Cluster Mode) -->

            
            <!-- Dark mode toggle -->
            <button
              @click="toggleColorMode"
              class="header-icon-btn"
              title="Toggle dark mode"
            >
              <!-- The server cannot know the visitor's theme; rendering the icon on the client avoids a hydration mismatch. -->
              <ClientOnly><template #fallback><span class="block w-5 h-5" /></template>
              <svg v-if="colorMode.value === 'dark'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
              </ClientOnly>
            </button>

            <!-- Keyboard shortcuts help -->
            <button
              @click="showShortcutsHelp = true"
              class="header-icon-btn"
              title="Keyboard shortcuts (?)"
              :class="'hidden sm:inline-flex'"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <!-- Profile dropdown -->
            <UDropdownMenu
              :items="profileMenuItems"
              :content="{ align: 'end' }"
            >
              <button class="header-icon-btn">
                <div class="w-8 h-8 bg-tertiary rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                  </svg>
                </div>
              </button>
            </UDropdownMenu>

            <!-- Mobile menu button -->
            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="lg:hidden header-icon-btn" aria-label="Open navigation"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile menu -->
        <div v-if="mobileMenuOpen" class="lg:hidden py-4 border-t border-default">
          <nav class="flex flex-col gap-2">
            <NuxtLink
              to="/dashboard"
              class="mobile-nav-link"
              active-class="mobile-nav-link-active"
              @click="mobileMenuOpen = false"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/monitors"
              class="mobile-nav-link"
              :class="{ 'mobile-nav-link-active': monitorsActive }"
              @click="mobileMenuOpen = false"
            >
              Monitors
            </NuxtLink>
            <NuxtLink
              to="/monitors/groups"
              class="mobile-nav-link"
              active-class="mobile-nav-link-active"
              @click="mobileMenuOpen = false"
            >
              Groups
            </NuxtLink>
            <NuxtLink
              to="/maintenance"
              class="mobile-nav-link"
              active-class="mobile-nav-link-active"
              @click="mobileMenuOpen = false"
            >
              Maintenance
            </NuxtLink>
            <NuxtLink
              to="/reports"
              class="mobile-nav-link"
              active-class="mobile-nav-link-active"
              @click="mobileMenuOpen = false"
            >
              Reports
            </NuxtLink>
            <NuxtLink
              to="/settings"
              class="mobile-nav-link"
              active-class="mobile-nav-link-active"
              @click="mobileMenuOpen = false"
            >
              Settings
            </NuxtLink>
            <NuxtLink
              to="/status-pages"
              class="mobile-nav-link"
              active-class="mobile-nav-link-active"
              @click="mobileMenuOpen = false"
            >
              Status Pages
            </NuxtLink>
            <NuxtLink
              to="/api-docs"
              class="mobile-nav-link"
              active-class="mobile-nav-link-active"
              @click="mobileMenuOpen = false"
            >
              API Docs
            </NuxtLink>
          </nav>
        </div>
      </div>
    </header>

    <div class="border-b border-default bg-[var(--bg-secondary)]"><div class="w-full max-w-[1600px] mr-auto px-4 sm:px-6 lg:px-8 py-3"><ClientOnly><LayoutWorkspaceSelector /></ClientOnly></div></div>
    <!-- Main content -->
    <main class="w-full max-w-[1600px] mr-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>

    <!-- Keyboard shortcuts help modal -->
    <CommonKeyboardShortcutsHelp v-model="showShortcutsHelp" />
  </div>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const route = useRoute()
// /monitors/groups has its own nav entry
const monitorsActive = computed(() => route.path.startsWith('/monitors') && !route.path.startsWith('/monitors/groups'))
const mobileMenuOpen = ref(false)
const { clear } = useUserSession()

// Toggle color mode
const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Use shared keyboard shortcuts state
const { showHelp } = useKeyboardShortcuts()
const showShortcutsHelp = showHelp

const profileMenuItems = [
  [
    {
      label: 'Profile',
      icon: 'i-heroicons-user',
      to: '/settings/profile'
    },
    {
      label: 'Settings',
      icon: 'i-heroicons-cog-6-tooth',
      to: '/settings'
    }
  ],
  [
    {
      label: 'Logout',
      icon: 'i-heroicons-arrow-right-on-rectangle',
      onSelect: handleLogout
    }
  ]
]

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
/* Layout root */
.layout-root {
  min-height: 100vh;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Header */
.header-main {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
}

/* Nav links */
.nav-link {
  color: var(--text-secondary);
  transition: color 0.2s ease;
  padding: 0.35rem 0.5rem;
  border-radius: 0.5rem;
}

.nav-link:hover {
  color: var(--text-primary);
  background-color: var(--hover-bg);
}

.nav-link-active {
  color: var(--uk-primary-text) !important;
  background-color: var(--uk-primary-soft);
}

/* Header icon button */
.header-icon-btn {
  padding: 0.5rem;
  color: var(--text-tertiary);
  transition: color 0.2s ease;
}

.header-icon-btn:hover {
  color: var(--text-primary);
}

/* Background tertiary class */
.bg-tertiary {
  background-color: var(--bg-tertiary);
}

/* Mobile nav */
.mobile-nav-link {
  padding: 0.5rem 0.75rem;
  color: var(--text-secondary);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.mobile-nav-link:hover {
  color: var(--text-primary);
  background-color: var(--hover-bg);
}

.mobile-nav-link-active {
  color: var(--uk-primary-text) !important;
  background-color: var(--uk-primary-soft);
}
</style>
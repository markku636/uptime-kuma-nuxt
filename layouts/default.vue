<template>
  <div class="min-h-screen bg-gray-900 text-gray-100">
    <!-- Header -->
    <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/dashboard" class="flex items-center gap-2 text-white hover:text-green-400 transition-colors">
            <img src="/icon.svg" alt="Uptime Kuma" class="h-8 w-8" />
            <span class="text-xl font-bold">Uptime Kuma</span>
          </NuxtLink>

          <!-- Navigation -->
          <nav class="hidden md:flex items-center gap-6">
            <NuxtLink
              to="/dashboard"
              class="text-gray-300 hover:text-white transition-colors"
              active-class="text-green-400"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/monitors"
              class="text-gray-300 hover:text-white transition-colors"
              active-class="text-green-400"
            >
              Monitors
            </NuxtLink>
            <NuxtLink
              to="/settings"
              class="text-gray-300 hover:text-white transition-colors"
              active-class="text-green-400"
            >
              Settings
            </NuxtLink>
          </nav>

          <!-- Right side -->
          <div class="flex items-center gap-4">
            <!-- Dark mode toggle -->
            <button
              @click="toggleDarkMode"
              class="p-2 text-gray-400 hover:text-white transition-colors"
              title="Toggle dark mode"
            >
              <svg v-if="isDark" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            </button>

            <!-- Keyboard shortcuts help -->
            <button
              @click="showShortcutsHelp = true"
              class="p-2 text-gray-400 hover:text-white transition-colors"
              title="Keyboard shortcuts (Ctrl+/)"
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
              <button class="flex items-center gap-2 p-2 text-gray-400 hover:text-white transition-colors">
                <div class="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                  </svg>
                </div>
              </button>
            </UDropdownMenu>

            <!-- Mobile menu button -->
            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile menu -->
        <div v-if="mobileMenuOpen" class="md:hidden py-4 border-t border-gray-700">
          <nav class="flex flex-col gap-2">
            <NuxtLink
              to="/dashboard"
              class="px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              active-class="text-green-400 bg-gray-700"
              @click="mobileMenuOpen = false"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/monitors"
              class="px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              active-class="text-green-400 bg-gray-700"
              @click="mobileMenuOpen = false"
            >
              Monitors
            </NuxtLink>
            <NuxtLink
              to="/settings"
              class="px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              active-class="text-green-400 bg-gray-700"
              @click="mobileMenuOpen = false"
            >
              Settings
            </NuxtLink>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>

    <!-- Keyboard shortcuts help modal -->
    <KeyboardShortcutsHelp v-model="showShortcutsHelp" />
  </div>
</template>

<script setup lang="ts">
const mobileMenuOpen = ref(false)
const isDark = ref(true)
const showShortcutsHelp = ref(false)

// Initialize keyboard shortcuts
const { toggleHelp } = useKeyboardShortcuts()

// Override the help toggle to control our modal
watch(() => toggleHelp, () => {
  showShortcutsHelp.value = !showShortcutsHelp.value
})

// Listen for keyboard shortcut to show help
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    // Show help on Ctrl+/ or ?
    if ((e.ctrlKey && e.key === '/') || (e.key === '?' && !e.ctrlKey && !e.altKey)) {
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
        e.preventDefault()
        showShortcutsHelp.value = !showShortcutsHelp.value
      }
    }
  }
  
  window.addEventListener('keydown', handleKeydown)
  
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
})

const toggleDarkMode = () => {
  isDark.value = !isDark.value
  // In a real app, you'd persist this and apply to document
}

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
      click: () => {
        navigateTo('/login')
      }
    }
  ]
]
</script>

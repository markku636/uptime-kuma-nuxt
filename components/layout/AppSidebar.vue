<template>
  <aside class="w-64 bg-default border-r border-default min-h-[calc(100vh-4rem)]">
    <nav class="p-4 space-y-2">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors"
        :class="[
          isActive(item.to) 
            ? 'bg-primary/10 text-link' 
            : 'text-toned hover:bg-elevated'
        ]"
      >
        <UIcon :name="item.icon" class="w-5 h-5" />
        <span>{{ item.label }}</span>
      </NuxtLink>

      <!-- Add Monitor Button -->
      <div class="pt-4 border-t border-default">
        <UButton
          to="/monitors/add"
          icon="i-heroicons-plus"
          block
          color="primary"
        >
          Add Monitor
        </UButton>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: 'i-heroicons-home' },
  { label: 'Monitors', to: '/monitors', icon: 'i-heroicons-server' },
  { label: 'Status Pages', to: '/status-pages', icon: 'i-heroicons-document-text' },
  { label: 'Maintenance', to: '/maintenance', icon: 'i-heroicons-wrench-screwdriver' },
  { label: 'Settings', to: '/settings', icon: 'i-heroicons-cog-6-tooth' },
]

const isActive = (path: string) => {
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="page-container">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Monitors</h1>
        <p class="text-gray-400">Manage your monitors</p>
      </div>
      <NuxtLink to="/monitors/add" class="btn btn-primary">
        <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
        Add Monitor
      </NuxtLink>
    </div>

    <!-- Search and Filter Bar -->
    <div class="card card-body mb-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- Search Input -->
        <div class="flex-1">
          <UInput
            v-model="searchQuery"
            placeholder="Search monitors..."
            icon="i-heroicons-magnifying-glass"
            class="w-full"
          />
        </div>
        
        <!-- View Toggle -->
        <div class="flex items-center gap-2">
          <span class="text-gray-400 text-sm">View:</span>
          <UButtonGroup>
            <UButton
              :color="viewMode === 'list' ? 'primary' : 'neutral'"
              :variant="viewMode === 'list' ? 'solid' : 'outline'"
              icon="i-heroicons-list-bullet"
              @click="viewMode = 'list'"
            />
            <UButton
              :color="viewMode === 'grouped' ? 'primary' : 'neutral'"
              :variant="viewMode === 'grouped' ? 'solid' : 'outline'"
              icon="i-heroicons-rectangle-group"
              @click="viewMode = 'grouped'"
            />
          </UButtonGroup>
        </div>
        
        <!-- Status Filter -->
        <USelect
          v-model="statusFilter"
          :items="statusFilterOptions"
          placeholder="All Statuses"
          class="w-40"
        />
      </div>
    </div>

    <div class="card card-body">
      <div v-if="pending" class="text-center py-12">
        <div class="spinner w-8 h-8 mx-auto"></div>
        <p class="text-gray-400 mt-2">Loading monitors...</p>
      </div>

      <div v-else-if="filteredMonitors.length === 0 && monitors.length > 0" class="text-center py-12">
        <UIcon name="i-heroicons-magnifying-glass" class="w-12 h-12 mx-auto text-gray-500 mb-3" />
        <p class="text-gray-400 mb-4">No monitors match your search</p>
        <UButton variant="outline" @click="clearFilters">
          Clear Filters
        </UButton>
      </div>

      <div v-else-if="monitors.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-server" class="w-12 h-12 mx-auto text-gray-500 mb-3" />
        <p class="text-gray-400 mb-4">No monitors yet</p>
        <NuxtLink to="/monitors/add" class="btn btn-primary">
          Add your first monitor
        </NuxtLink>
      </div>

      <!-- List View -->
      <div v-else-if="viewMode === 'list'" class="space-y-3">
        <NuxtLink
          v-for="monitor in filteredMonitors"
          :key="monitor.id"
          :to="`/monitors/${monitor.id}`"
          class="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span :class="getStatusDotClass(monitor)" class="w-3 h-3 rounded-full"></span>
              <span class="font-semibold text-gray-100">{{ monitor.name }}</span>
              <span class="text-gray-500 text-sm uppercase">{{ monitor.type }}</span>
              <!-- Tags -->
              <template v-if="monitor.tags?.length">
                <span
                  v-for="tag in monitor.tags.slice(0, 3)"
                  :key="tag.id"
                  :style="{ backgroundColor: tag.color || '#6b7280' }"
                  class="px-2 py-0.5 text-xs rounded text-white"
                >
                  {{ tag.name }}
                </span>
              </template>
            </div>
            <span :class="getStatusBadgeClass(monitor)" class="badge">
              {{ getStatusText(monitor) }}
            </span>
          </div>
          <div v-if="monitor.url" class="text-gray-400 text-sm mt-1 ml-6 truncate">
            {{ monitor.url }}
          </div>
        </NuxtLink>
      </div>

      <!-- Grouped View -->
      <div v-else-if="viewMode === 'grouped'" class="space-y-6">
        <!-- Group monitors -->
        <div v-for="(group, groupName) in groupedMonitors" :key="groupName" class="space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-700">
            <UIcon name="i-heroicons-folder" class="w-5 h-5 text-gray-400" />
            <h3 class="text-lg font-medium text-white">{{ groupName }}</h3>
            <span class="text-gray-500 text-sm">({{ group.length }})</span>
          </div>
          
          <NuxtLink
            v-for="monitor in group"
            :key="monitor.id"
            :to="`/monitors/${monitor.id}`"
            class="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span :class="getStatusDotClass(monitor)" class="w-3 h-3 rounded-full"></span>
                <span class="font-semibold text-gray-100">{{ monitor.name }}</span>
                <span class="text-gray-500 text-sm uppercase">{{ monitor.type }}</span>
              </div>
              <span :class="getStatusBadgeClass(monitor)" class="badge">
                {{ getStatusText(monitor) }}
              </span>
            </div>
            <div v-if="monitor.url" class="text-gray-400 text-sm mt-1 ml-6 truncate">
              {{ monitor.url }}
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
      <div class="card card-body text-center">
        <span class="text-2xl font-bold text-white">{{ monitors.length }}</span>
        <span class="text-gray-400 text-sm">Total</span>
      </div>
      <div class="card card-body text-center">
        <span class="text-2xl font-bold text-emerald-500">{{ upMonitors }}</span>
        <span class="text-gray-400 text-sm">Up</span>
      </div>
      <div class="card card-body text-center">
        <span class="text-2xl font-bold text-red-500">{{ downMonitors }}</span>
        <span class="text-gray-400 text-sm">Down</span>
      </div>
      <div class="card card-body text-center">
        <span class="text-2xl font-bold text-gray-500">{{ pausedMonitors }}</span>
        <span class="text-gray-400 text-sm">Paused</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const { data, pending } = await useFetch('/api/v1/monitors', {
  headers: useRequestHeaders(['cookie'])
})

const monitors = computed(() => data.value?.data || [])

// Search and filter state
const searchQuery = ref('')
const statusFilter = ref<string | null>(null)
const viewMode = ref<'list' | 'grouped'>('list')

const statusFilterOptions = [
  { label: 'All Statuses', value: null },
  { label: 'Up', value: 'up' },
  { label: 'Down', value: 'down' },
  { label: 'Paused', value: 'paused' },
  { label: 'Pending', value: 'pending' }
]

// Filtered monitors based on search and status
const filteredMonitors = computed(() => {
  return monitors.value.filter(monitor => {
    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      const matchesName = monitor.name?.toLowerCase().includes(query)
      const matchesUrl = monitor.url?.toLowerCase().includes(query)
      const matchesType = monitor.type?.toLowerCase().includes(query)
      if (!matchesName && !matchesUrl && !matchesType) {
        return false
      }
    }
    
    // Status filter
    if (statusFilter.value) {
      const status = getStatusText(monitor).toLowerCase()
      if (statusFilter.value !== status) {
        return false
      }
    }
    
    return true
  })
})

// Grouped monitors by tag or type
const groupedMonitors = computed(() => {
  const groups: Record<string, any[]> = {}
  
  filteredMonitors.value.forEach(monitor => {
    // Group by first tag, or by type if no tags
    const groupName = monitor.tags?.[0]?.name || monitor.type?.toUpperCase() || 'Other'
    
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(monitor)
  })
  
  // Sort groups alphabetically
  const sortedGroups: Record<string, any[]> = {}
  Object.keys(groups).sort().forEach(key => {
    sortedGroups[key] = groups[key]
  })
  
  return sortedGroups
})

// Stats
const upMonitors = computed(() => monitors.value.filter(m => m.active && getLatestStatus(m) === 1).length)
const downMonitors = computed(() => monitors.value.filter(m => m.active && getLatestStatus(m) === 0).length)
const pausedMonitors = computed(() => monitors.value.filter(m => !m.active).length)

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = null
}

function getLatestStatus(monitor: any) {
  return monitor.heartbeats?.[0]?.status ?? -1
}

function getStatusText(monitor: any) {
  if (!monitor.active) return 'PAUSED'
  const status = getLatestStatus(monitor)
  switch (status) {
    case 1: return 'UP'
    case 0: return 'DOWN'
    case 3: return 'MAINTENANCE'
    default: return 'PENDING'
  }
}

function getStatusDotClass(monitor: any) {
  if (!monitor.active) return 'bg-gray-500'
  const status = getLatestStatus(monitor)
  switch (status) {
    case 1: return 'bg-emerald-500'
    case 0: return 'bg-red-500'
    case 3: return 'bg-blue-500'
    default: return 'bg-gray-500'
  }
}

function getStatusBadgeClass(monitor: any) {
  if (!monitor.active) return 'bg-gray-700 text-gray-400'
  const status = getLatestStatus(monitor)
  switch (status) {
    case 1: return 'badge-success'
    case 0: return 'badge-danger'
    case 3: return 'badge-info'
    default: return 'bg-gray-700 text-gray-400'
  }
}
</script>

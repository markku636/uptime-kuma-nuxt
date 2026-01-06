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

    <div class="card card-body">
      <div v-if="pending" class="text-center py-12">
        <div class="spinner w-8 h-8 mx-auto"></div>
        <p class="text-gray-400 mt-2">Loading monitors...</p>
      </div>

      <div v-else-if="monitors.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-server" class="w-12 h-12 mx-auto text-gray-500 mb-3" />
        <p class="text-gray-400 mb-4">No monitors yet</p>
        <NuxtLink to="/monitors/add" class="btn btn-primary">
          Add your first monitor
        </NuxtLink>
      </div>

      <div v-else class="space-y-3">
        <NuxtLink
          v-for="monitor in monitors"
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
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const { data, pending } = await useFetch('/api/v1/monitors', {
  headers: useRequestHeaders(['cookie'])
})

const monitors = computed(() => data.value?.data || [])

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

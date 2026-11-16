<template>
  <div class="page-container">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">Monitors</h1>
        <p class="text-toned">Manage your monitors</p>
      </div>
      <NuxtLink to="/monitors/add" class="btn btn-primary">
        <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
        Add Monitor
      </NuxtLink>
    </div>

    <div class="card card-body">
      <div v-if="pending" class="text-center py-12">
        <div class="spinner w-8 h-8 mx-auto"></div>
        <p class="text-toned mt-2">Loading monitors...</p>
      </div>

      <div v-else-if="monitors.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-server" class="w-12 h-12 mx-auto text-muted mb-3" />
        <p class="text-toned mb-4">No monitors yet</p>
        <NuxtLink to="/monitors/add" class="btn btn-primary">
          Add your first monitor
        </NuxtLink>
      </div>

      <div v-else class="space-y-3">
        <NuxtLink
          v-for="monitor in monitors"
          :key="monitor.id"
          :to="`/monitors/${monitor.id}`"
          class="block p-4 bg-elevated rounded-lg hover:bg-accented transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span :class="getStatusDotClass(monitor)" class="w-3 h-3 rounded-full"></span>
              <span class="font-semibold text-highlighted">{{ monitor.name }}</span>
              <span class="text-muted text-sm uppercase">{{ monitor.type }}</span>
            </div>
            <span :class="getStatusBadgeClass(monitor)" class="badge">
              {{ getStatusText(monitor) }}
            </span>
          </div>
          <div v-if="monitor.url" class="text-toned text-sm mt-1 ml-6 truncate">
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
  if (!monitor.active) return 'bg-unknown'
  const status = getLatestStatus(monitor)
  switch (status) {
    case 1: return 'bg-up'
    case 0: return 'bg-down'
    case 3: return 'bg-maintenance'
    default: return 'bg-unknown'
  }
}

function getStatusBadgeClass(monitor: any) {
  if (!monitor.active) return 'bg-unknown-subtle text-unknown-fg'
  const status = getLatestStatus(monitor)
  switch (status) {
    case 1: return 'badge-success'
    case 0: return 'badge-danger'
    case 3: return 'badge-info'
    default: return 'bg-unknown-subtle text-unknown-fg'
  }
}
</script>

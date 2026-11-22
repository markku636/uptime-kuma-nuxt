<template>
  <div class="page-container">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Monitors</h1>
        <p class="text-gray-600 dark:text-gray-400">Manage your monitors</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <NuxtLink to="/monitors/groups" class="btn btn-secondary">
          <UIcon name="i-heroicons-folder" class="w-4 h-4 mr-2" />
          Groups
        </NuxtLink>
        <NuxtLink v-if="canEdit" to="/monitors/add" class="btn btn-primary shrink-0">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
          Add Monitor
        </NuxtLink>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-4"><input v-model="search" class="input-field" placeholder="Search monitors..." aria-label="Search monitors" data-search-input maxlength="200"/><select v-model="status" class="select-field"><option value="all">All statuses</option><option value="up">Up</option><option value="down">Down</option><option value="pending">Pending</option><option value="maintenance">Maintenance</option><option value="paused">Paused</option><option value="stale">Stale</option></select><select v-model="type" class="select-field" aria-label="Monitor type"><option value="all">All types</option><option value="http">HTTP</option><option value="keyword">Keyword</option><option value="json-query">JSON query</option><option value="push">Push</option><option value="tcp">TCP (unsupported)</option></select></div>
    <p v-if="error" role="alert">Unable to load monitors.</p>
    <MonitorPagination :count="monitors.length" :total="summary.total" :can-back="canBack" :has-more="!!page?.hasMore" :loading="pending" @back="back" @next="next" />
    <div class="card card-body">
      <div v-if="pending" class="text-center py-12">
        <div class="spinner w-8 h-8 mx-auto"></div>
        <p class="text-gray-600 dark:text-gray-400 mt-2">Loading monitors...</p>
      </div>

      <div v-else-if="monitors.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-server" class="w-12 h-12 mx-auto text-gray-500 mb-3" />
        <p class="text-gray-600 dark:text-gray-400 mb-4">No monitors yet</p>
        <NuxtLink v-if="canEdit" to="/monitors/add" class="btn btn-primary shrink-0">
          Add your first monitor
        </NuxtLink>
      </div>

      <div v-else class="space-y-3">
        <NuxtLink
          v-for="monitor in monitors"
          :key="monitor.id"
          :to="`/monitors/${monitor.id}`"
          class="block p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <span :class="getStatusDotClass(monitor)" class="w-3 h-3 rounded-full"></span>
              <span class="min-w-0 truncate font-semibold text-gray-900 dark:text-gray-100">{{ monitor.name }}</span>
              <span class="text-gray-500 text-sm uppercase shrink-0 hidden sm:inline">{{ monitor.type }}</span>
            </div>
            <span :class="getStatusBadgeClass(monitor)" class="badge">
              {{ getStatusText(monitor) }}
            </span>
          </div>
          <div class="mt-1 ml-6 text-xs uppercase text-secondary sm:hidden">{{ monitor.type }}</div>
          <div v-if="monitor.url" class="text-gray-600 dark:text-gray-400 text-sm mt-1 ml-6 truncate">
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

const {search,status,type,monitors,pending,error,page,summary,next,back,canBack}=useMonitorPage()
const {canEdit}=useWorkspace()
function getLatestStatus(monitor: any) {
  return monitor.heartbeats?.[0]?.status ?? -1
}

function getStatusText(monitor: any) {
  if (!monitor.active) return 'PAUSED'
  if(monitor.viewStatus==='stale')return 'STALE'
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

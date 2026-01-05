<template>
  <div class="page-container">
    <!-- Header with Connection Status -->
    <div class="flex items-center justify-between mb-6">
      <NuxtLink to="/monitors/add" class="btn btn-primary">
        <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
        Add New Monitor
      </NuxtLink>
      <div class="flex items-center gap-2 text-sm">
        <span 
          class="w-2 h-2 rounded-full" 
          :class="socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'"
        ></span>
        <span class="text-gray-400">{{ socketConnected ? 'Live' : 'Offline' }}</span>
      </div>
    </div>

    <!-- Quick Stats -->
    <h2 class="section-title">Quick Stats</h2>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-emerald-500/50" @click="filterByStatus('up')">
        <div class="stat-label">Up</div>
        <div class="stat-value" :class="stats.up > 0 ? 'text-emerald-400' : 'text-gray-500'">
          {{ stats.up }}
        </div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-red-500/50" @click="filterByStatus('down')">
        <div class="stat-label">Down</div>
        <div class="stat-value" :class="stats.down > 0 ? 'text-red-400' : 'text-gray-500'">
          {{ stats.down }}
        </div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-blue-500/50" @click="filterByStatus('maintenance')">
        <div class="stat-label">Maintenance</div>
        <div class="stat-value" :class="stats.maintenance > 0 ? 'text-blue-400' : 'text-gray-500'">
          {{ stats.maintenance }}
        </div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-gray-500/50" @click="filterByStatus('unknown')">
        <div class="stat-label">Unknown</div>
        <div class="stat-value text-gray-500">{{ stats.unknown }}</div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-gray-500/50" @click="filterByStatus('paused')">
        <div class="stat-label">Paused</div>
        <div class="stat-value text-gray-500">{{ stats.paused }}</div>
      </div>
    </div>

    <!-- Search and Filter Bar -->
    <div class="card card-body mb-6">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1 relative">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            v-model="searchQuery" 
            type="text" 
            class="input-field pl-10" 
            placeholder="Search monitors..."
          />
        </div>
        <div class="flex gap-2">
          <select v-model="statusFilter" class="select-field">
            <option value="all">All Status</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="maintenance">Maintenance</option>
            <option value="unknown">Unknown</option>
            <option value="paused">Paused</option>
          </select>
          <select v-model="typeFilter" class="select-field">
            <option value="all">All Types</option>
            <option value="http">HTTP(s)</option>
            <option value="tcp">TCP</option>
            <option value="ping">Ping</option>
            <option value="dns">DNS</option>
            <option value="docker">Docker</option>
            <option value="push">Push</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Important Events -->
    <div class="card mb-6">
      <div class="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-100">Important Events</h3>
        <span class="text-sm text-gray-400">{{ importantHeartbeats.length }} events</span>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>DateTime</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(beat, index) in importantHeartbeats" :key="index" class="hover:bg-gray-700/50">
              <td>
                <NuxtLink :to="`/monitors/${beat.monitorId}`" class="link">
                  {{ getMonitorName(beat.monitorId) }}
                </NuxtLink>
              </td>
              <td>
                <span :class="getStatusClass(beat.status)">
                  {{ getStatusText(beat.status) }}
                </span>
              </td>
              <td class="text-gray-400">{{ formatDateTime(beat.time) }}</td>
              <td class="text-gray-400 max-w-xs truncate">{{ beat.msg || '-' }}</td>
            </tr>
            <tr v-if="importantHeartbeats.length === 0">
              <td colspan="4" class="text-center text-gray-500 py-8">
                <UIcon name="i-heroicons-check-circle" class="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p>No important events - all systems operational</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Monitor List -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="section-title !mb-0">Monitors ({{ filteredMonitors.length }})</h2>
      <div class="flex items-center gap-2">
        <button 
          @click="viewMode = 'grid'" 
          class="p-2 rounded" 
          :class="viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'"
        >
          <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5" />
        </button>
        <button 
          @click="viewMode = 'list'" 
          class="p-2 rounded"
          :class="viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'"
        >
          <UIcon name="i-heroicons-list-bullet" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <div v-if="pending" class="text-center py-8">
      <div class="spinner w-8 h-8 mx-auto"></div>
      <p class="text-gray-400 mt-2">Loading monitors...</p>
    </div>
    <div v-else-if="filteredMonitors.length === 0" class="card card-body text-center text-gray-400 py-8">
      <template v-if="monitors.length === 0">
        No monitors yet. Click "Add New Monitor" to create one.
      </template>
      <template v-else>
        No monitors match your filters.
        <button @click="clearFilters" class="link ml-1">Clear filters</button>
      </template>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid'" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="monitor in filteredMonitors"
        :key="monitor.id"
        :to="`/monitors/${monitor.id}`"
        class="card card-body hover:bg-gray-700 transition-colors cursor-pointer group"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors">{{ monitor.name }}</span>
          <span :class="getMonitorStatusClass(monitor)" class="badge">
            {{ getMonitorStatusText(monitor) }}
          </span>
        </div>
        <div class="text-sm text-gray-400 mb-1">
          <span class="uppercase font-medium">{{ monitor.type }}</span>
          <span v-if="monitor.url" class="ml-2 truncate block">{{ monitor.url }}</span>
          <span v-else-if="monitor.hostname" class="ml-2">{{ monitor.hostname }}{{ monitor.port ? `:${monitor.port}` : '' }}</span>
        </div>
        <div v-if="getLatestPing(monitor)" class="text-xs text-gray-500 mb-2">
          Response: {{ getLatestPing(monitor) }}ms
        </div>
        <div class="mt-auto flex items-center gap-0.5">
          <div
            v-for="(beat, i) in getRecentHeartbeats(monitor)"
            :key="i"
            class="h-6 w-1.5 rounded-full transition-all"
            :class="getHeartbeatClass(beat)"
            :title="beat ? `${formatDateTime(beat.time)} - ${beat.ping || 0}ms` : 'No data'"
          ></div>
        </div>
      </NuxtLink>
    </div>

    <!-- List View -->
    <div v-else class="card overflow-hidden">
      <table class="table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Name</th>
            <th>Type</th>
            <th>Target</th>
            <th>Response</th>
            <th>Uptime (24h)</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="monitor in filteredMonitors" :key="monitor.id" class="hover:bg-gray-700/50">
            <td>
              <span :class="getMonitorStatusClass(monitor)" class="badge">
                {{ getMonitorStatusText(monitor) }}
              </span>
            </td>
            <td>
              <NuxtLink :to="`/monitors/${monitor.id}`" class="link font-medium">
                {{ monitor.name }}
              </NuxtLink>
            </td>
            <td class="text-gray-400 uppercase text-sm">{{ monitor.type }}</td>
            <td class="text-gray-400 text-sm max-w-xs truncate">
              {{ monitor.url || monitor.hostname || '-' }}
            </td>
            <td class="text-gray-400">
              {{ getLatestPing(monitor) ? `${getLatestPing(monitor)}ms` : '-' }}
            </td>
            <td>
              <div class="flex items-center gap-1">
                <div
                  v-for="(beat, i) in getRecentHeartbeats(monitor, 10)"
                  :key="i"
                  class="h-4 w-1 rounded-full"
                  :class="getHeartbeatClass(beat)"
                ></div>
              </div>
            </td>
            <td class="text-right">
              <div class="flex items-center justify-end gap-1">
                <button 
                  v-if="monitor.active"
                  @click.prevent="pauseMonitor(monitor.id)" 
                  class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-yellow-400"
                  title="Pause"
                >
                  <UIcon name="i-heroicons-pause" class="w-4 h-4" />
                </button>
                <button 
                  v-else
                  @click.prevent="resumeMonitor(monitor.id)" 
                  class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-emerald-400"
                  title="Resume"
                >
                  <UIcon name="i-heroicons-play" class="w-4 h-4" />
                </button>
                <NuxtLink 
                  :to="`/monitors/${monitor.id}/edit`" 
                  class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-blue-400"
                  title="Edit"
                >
                  <UIcon name="i-heroicons-pencil" class="w-4 h-4" />
                </NuxtLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

definePageMeta({
  middleware: ['auth']
})

// Socket connection
const { $socket } = useNuxtApp()
const socketConnected = ref(false)
const heartbeatsMap = ref<Record<number, any[]>>({})

// View state
const viewMode = ref<'grid' | 'list'>('grid')
const searchQuery = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')

// Fetch monitors
const { data, pending, refresh } = await useFetch('/api/v1/monitors', {
  credentials: 'include',
  headers: useRequestHeaders(['cookie'])
})

const monitors = computed(() => data.value?.data || [])

// Merge real-time heartbeats with fetched data
const monitorsWithLiveData = computed(() => {
  return monitors.value.map((m: any) => ({
    ...m,
    heartbeats: heartbeatsMap.value[m.id] || m.heartbeats || []
  }))
})

// Filtered monitors
const filteredMonitors = computed(() => {
  let result = monitorsWithLiveData.value

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((m: any) => 
      m.name.toLowerCase().includes(query) ||
      m.url?.toLowerCase().includes(query) ||
      m.hostname?.toLowerCase().includes(query)
    )
  }

  // Status filter
  if (statusFilter.value !== 'all') {
    result = result.filter((m: any) => {
      const status = getLatestStatus(m)
      switch (statusFilter.value) {
        case 'up': return m.active && status === 1
        case 'down': return m.active && status === 0
        case 'maintenance': return status === 3
        case 'unknown': return m.active && status === 2
        case 'paused': return !m.active
        default: return true
      }
    })
  }

  // Type filter
  if (typeFilter.value !== 'all') {
    result = result.filter((m: any) => m.type === typeFilter.value)
  }

  return result
})

const stats = computed(() => {
  const list = monitorsWithLiveData.value
  return {
    up: list.filter((m: any) => m.active && getLatestStatus(m) === 1).length,
    down: list.filter((m: any) => m.active && getLatestStatus(m) === 0).length,
    maintenance: list.filter((m: any) => getLatestStatus(m) === 3).length,
    unknown: list.filter((m: any) => m.active && getLatestStatus(m) === 2).length,
    paused: list.filter((m: any) => !m.active).length,
  }
})

const filterByStatus = (status: string) => {
  statusFilter.value = statusFilter.value === status ? 'all' : status
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = 'all'
  typeFilter.value = 'all'
}

const getLatestStatus = (monitor: any) => {
  const heartbeats = heartbeatsMap.value[monitor.id] || monitor.heartbeats || []
  return heartbeats[0]?.status ?? -1
}

const getLatestPing = (monitor: any) => {
  const heartbeats = heartbeatsMap.value[monitor.id] || monitor.heartbeats || []
  return heartbeats[0]?.ping || null
}

const getMonitorName = (monitorId: number) => {
  const monitor = monitors.value.find((m: any) => m.id === monitorId)
  return monitor?.name || `Monitor ${monitorId}`
}

const importantHeartbeats = computed(() => {
  const events: any[] = []
  monitorsWithLiveData.value.forEach((m: any) => {
    const heartbeats = m.heartbeats || []
    heartbeats.forEach((h: any) => {
      if (h.important || h.status === 0) {
        events.push({ ...h, monitorId: m.id })
      }
    })
  })
  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 25)
})

const formatDateTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const getStatusClass = (status: number) => {
  switch (status) {
    case 1: return 'badge badge-success'
    case 0: return 'badge badge-danger'
    case 3: return 'badge badge-info'
    default: return 'badge'
  }
}

const getStatusText = (status: number) => {
  switch (status) {
    case 1: return 'UP'
    case 0: return 'DOWN'
    case 3: return 'MAINTENANCE'
    default: return 'UNKNOWN'
  }
}

const getMonitorStatusClass = (monitor: any) => {
  if (!monitor.active) return 'bg-gray-700 text-gray-400'
  const status = getLatestStatus(monitor)
  switch (status) {
    case 1: return 'badge-success'
    case 0: return 'badge-danger'
    case 3: return 'badge-info'
    default: return 'bg-gray-700 text-gray-400'
  }
}

const getMonitorStatusText = (monitor: any) => {
  if (!monitor.active) return 'PAUSED'
  const status = getLatestStatus(monitor)
  switch (status) {
    case 1: return 'UP'
    case 0: return 'DOWN'
    case 3: return 'MAINTENANCE'
    default: return 'PENDING'
  }
}

const getRecentHeartbeats = (monitor: any, count: number = 20) => {
  const beats = heartbeatsMap.value[monitor.id] || monitor.heartbeats || []
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(beats[i] || null)
  }
  return result.reverse()
}

const getHeartbeatClass = (beat: any) => {
  if (!beat) return 'bg-gray-700'
  switch (beat.status) {
    case 1: return 'bg-emerald-500'
    case 0: return 'bg-red-500'
    case 3: return 'bg-blue-500'
    default: return 'bg-gray-500'
  }
}

// Pause/Resume actions
const pauseMonitor = async (id: number) => {
  try {
    await $fetch(`/api/v1/monitors/${id}/pause`, { method: 'POST' })
    refresh()
  } catch (e: any) {
    console.error('Failed to pause monitor:', e)
  }
}

const resumeMonitor = async (id: number) => {
  try {
    await $fetch(`/api/v1/monitors/${id}/resume`, { method: 'POST' })
    refresh()
  } catch (e: any) {
    console.error('Failed to resume monitor:', e)
  }
}

// WebSocket setup
let socket: any = null

onMounted(() => {
  if ($socket) {
    socket = $socket.connect()
    
    socket?.on('connect', () => {
      socketConnected.value = true
      console.log('[Dashboard] Socket connected')
      
      // Subscribe to monitor updates
      socket?.emit('subscribe_monitors')
    })
    
    socket?.on('disconnect', () => {
      socketConnected.value = false
      console.log('[Dashboard] Socket disconnected')
    })
    
    // Handle heartbeat updates
    socket?.on('heartbeat', (data: any) => {
      console.log('[Dashboard] Heartbeat received:', data)
      const { monitorId, heartbeat } = data
      
      if (!heartbeatsMap.value[monitorId]) {
        heartbeatsMap.value[monitorId] = []
      }
      
      // Add new heartbeat at the beginning
      heartbeatsMap.value[monitorId].unshift(heartbeat)
      
      // Keep only last 100 heartbeats
      if (heartbeatsMap.value[monitorId].length > 100) {
        heartbeatsMap.value[monitorId] = heartbeatsMap.value[monitorId].slice(0, 100)
      }
    })
    
    // Handle heartbeat list (bulk update)
    socket?.on('heartbeatList', (data: any) => {
      const { monitorId, heartbeats, overwrite } = data
      if (overwrite) {
        heartbeatsMap.value[monitorId] = heartbeats
      } else {
        heartbeatsMap.value[monitorId] = [...heartbeats, ...(heartbeatsMap.value[monitorId] || [])]
      }
    })
    
    // Handle monitor status change
    socket?.on('monitorStatus', (data: any) => {
      console.log('[Dashboard] Monitor status changed:', data)
      refresh()
    })
  }
  
  // Initialize heartbeats from fetched data
  monitors.value.forEach((m: any) => {
    if (m.heartbeats) {
      heartbeatsMap.value[m.id] = m.heartbeats
    }
  })
})

onUnmounted(() => {
  if (socket) {
    socket.emit('unsubscribe_monitors')
    $socket?.disconnect()
  }
})

// Auto-refresh every 30 seconds as fallback
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  refreshInterval = setInterval(() => {
    if (!socketConnected.value) {
      refresh()
    }
  }, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

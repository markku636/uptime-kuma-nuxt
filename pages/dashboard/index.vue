<template>
  <div class="page-container">
    <div class="mb-6"><h1 class="text-2xl font-bold text-primary">Monitor overview</h1><p class="text-secondary mt-1">Health and recent events in your selected environment.</p></div>
    <!-- Header with Connection Status -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <button v-if="canEdit" class="btn btn-secondary" @click="openQuickAdd">
          <UIcon name="i-heroicons-bolt" class="w-4 h-4 mr-2" />
          Quick add
        </button>
        <NuxtLink v-if="canEdit" to="/monitors/add" class="btn btn-primary">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
          Add New Monitor
        </NuxtLink>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span
          class="w-2 h-2 rounded-full"
          :class="socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'"
        ></span>
        <span class="text-secondary">{{ socketConnected ? 'Live' : 'Offline' }}</span>
      </div>
    </div>

    <!-- Quick Stats -->
    <h2 class="section-title">Quick Stats</h2>
    <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-emerald-500/50" @click="filterByStatus('up')">
        <div class="stat-label">Up</div>
        <div class="stat-value" :class="stats.up > 0 ? 'text-emerald-500' : 'text-tertiary'">
          {{ stats.up }}
        </div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-red-500/50" @click="filterByStatus('down')">
        <div class="stat-label">Down</div>
        <div class="stat-value" :class="stats.down > 0 ? 'text-red-500' : 'text-tertiary'">
          {{ stats.down }}
        </div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-blue-500/50" @click="filterByStatus('maintenance')">
        <div class="stat-label">Maintenance</div>
        <div class="stat-value" :class="stats.maintenance > 0 ? 'text-blue-500' : 'text-tertiary'">
          {{ stats.maintenance }}
        </div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-gray-500/50" @click="filterByStatus('unknown')">
        <div class="stat-label">Pending</div>
        <div class="stat-value text-tertiary">{{ stats.unknown }}</div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-gray-500/50" @click="filterByStatus('paused')">
        <div class="stat-label">Paused</div>
        <div class="stat-value text-tertiary">{{ stats.paused }}</div>
      </div>
      <div class="stat-card cursor-pointer hover:ring-2 hover:ring-amber-500/50" @click="filterByStatus('stale')"><div class="stat-label">Stale</div><div class="stat-value text-amber-500">{{stats.stale}}</div></div>
    </div>

    <!-- Search and Filter Bar -->
    <div class="card card-body mb-6">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1 relative">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-tertiary" />
          <input
            v-model="searchQuery"
            type="text"
            class="input-field !pl-10"
            placeholder="Search monitors..." aria-label="Search monitors" maxlength="200"
          />
        </div>
        <div class="flex gap-2">
          <select v-model="statusFilter" class="select-field">
            <option value="all">All Status</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="maintenance">Maintenance</option>
            <option value="unknown">Pending</option>
            <option value="paused">Paused</option><option value="stale">Stale</option>
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

    <!-- Monitor List -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="section-title !mb-0">Monitors ({{ stats.total }})</h2>
      <div class="flex items-center gap-2">
        <button
          @click="viewMode = 'grid'" aria-label="Grid view"
          class="p-2 rounded view-toggle"
          :class="viewMode === 'grid' ? 'active' : ''"
        >
          <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5" />
        </button>
        <button
          @click="viewMode = 'list'" aria-label="List view"
          class="p-2 rounded view-toggle"
          :class="viewMode === 'list' ? 'active' : ''"
        >
          <UIcon name="i-heroicons-list-bullet" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <p v-if="error" role="alert">Unable to load monitors. Please retry.</p>
    <MonitorPagination :count="monitors.length" :total="stats.total" :can-back="canBack" :has-more="!!page?.hasMore" :loading="pending" @back="back" @next="next" />
    <div v-if="pending" class="text-center py-8">
      <div class="spinner w-8 h-8 mx-auto"></div>
      <p class="text-secondary mt-2">Loading monitors...</p>
    </div>
    <div v-else-if="filteredMonitors.length === 0" class="card card-body text-center text-secondary py-8">
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
        class="card card-body card-interactive cursor-pointer group"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-primary group-hover:text-emerald-500 transition-colors">{{ monitor.name }}</span>
          <span :class="getMonitorStatusClass(monitor)" class="badge">
            {{ getMonitorStatusText(monitor) }}
          </span>
        </div>
        <div class="text-sm text-secondary mb-1">
          <span class="uppercase font-medium">{{ monitor.type }}</span>
          <span v-if="monitor.url" class="ml-2 truncate block">{{ monitor.url }}</span>
          <span v-else-if="monitor.hostname" class="ml-2">{{ monitor.hostname }}{{ monitor.port ? `:${monitor.port}` : '' }}</span>
        </div>
        <div v-if="getLatestPing(monitor)" class="text-xs text-tertiary mb-2">
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
    <div v-else class="card overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Name</th>
            <th>Type</th>
            <th>Target</th>
            <th>Response</th>
            <th>Recent checks</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="monitor in filteredMonitors" :key="monitor.id" class="hover-row">
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
            <td class="text-secondary uppercase text-sm">{{ monitor.type }}</td>
            <td class="text-secondary text-sm max-w-xs truncate">
              {{ monitor.url || monitor.hostname || '-' }}
            </td>
            <td class="text-secondary">
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
              <div v-if="canEdit" class="flex items-center justify-end gap-1">
                <button
                  v-if="monitor.active"
                  @click.prevent="pauseMonitor(monitor.id)"
                  class="action-btn"
                  title="Pause"
                >
                  <UIcon name="i-heroicons-pause" class="w-4 h-4" />
                </button>
                <button
                  v-else
                  @click.prevent="resumeMonitor(monitor.id)"
                  class="action-btn action-btn-success"
                  title="Resume"
                >
                  <UIcon name="i-heroicons-play" class="w-4 h-4" />
                </button>
                <NuxtLink
                  :to="`/monitors/${monitor.id}/edit`"
                  class="action-btn action-btn-info"
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
    <!-- Important Events -->
    <details class="card mt-6 mb-6">
      <summary class="p-4 flex items-center justify-between cursor-pointer">
        <h3 class="text-lg font-semibold text-primary">Important Events</h3>
        <span class="text-sm text-secondary">{{ importantHeartbeats.length }} events</span>
      </summary>
      <div class="overflow-x-auto max-h-64">
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
            <tr v-for="(beat, index) in importantHeartbeats" :key="index" class="hover-row">
              <td>
                <NuxtLink :to="`/monitors/${beat.monitorId}`" class="link">
                  {{ beat.monitorName || getMonitorName(beat.monitorId) }}
                </NuxtLink>
              </td>
              <td>
                <span :class="getStatusClass(beat.status)">
                  {{ getStatusText(beat.status) }}
                </span>
              </td>
              <td class="text-secondary">{{ formatDateTime(beat.time) }}</td>
              <td class="text-secondary max-w-xs truncate">{{ beat.msg || '-' }}</td>
            </tr>
            <tr v-if="importantHeartbeats.length === 0">
              <td colspan="4" class="text-center text-tertiary py-8">
                <UIcon name="i-heroicons-check-circle" class="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p>No recent status changes recorded</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

  </div>

  <!-- Quick add: one URL, sensible defaults, advanced form still available -->
  <div v-if="quickAddOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="quickAddOpen = false">
    <form class="card w-full max-w-lg p-6 space-y-4" @submit.prevent="submitQuickAdd">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">Add a monitor in seconds</h2>
          <p class="text-sm text-toned mt-1">We'll check every 60s and keep the defaults simple. Use the full form for assertions and notifications.</p>
        </div>
        <button type="button" class="text-toned hover:text-highlighted text-xl leading-none" aria-label="Close" @click="quickAddOpen = false">&times;</button>
      </div>
      <label class="block">
        <span class="text-sm text-toned">Website URL</span>
        <input v-model="quickAddUrl" type="url" inputmode="url" required maxlength="8192" autofocus
          placeholder="https://example.com" aria-label="Website URL" class="input-field mt-1" />
      </label>
      <p class="text-sm text-toned">Name: <strong class="text-highlighted">{{ quickAddName || '—' }}</strong></p>
      <p v-if="quickAddError" role="alert" class="text-sm text-red-400">{{ quickAddError }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <NuxtLink to="/monitors/add" class="btn btn-secondary">Advanced setup</NuxtLink>
        <button type="button" class="btn btn-secondary" @click="quickAddOpen = false">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="quickAddBusy || !quickAddName">
          {{ quickAddBusy ? 'Adding…' : 'Add monitor' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
const { canEdit } = useWorkspace()
import dayjs from 'dayjs'

definePageMeta({
  middleware: ['auth']
})

// Socket connection
const { $socket } = useNuxtApp()
const socketConnected = ref(false)
const heartbeatsMap = ref<Record<number, any[]>>({})
let socket:any=null

// Quick add (UptimeRobot-style single URL flow)
const toast = useToast()
const quickAddOpen = ref(false)
const quickAddUrl = ref('')
const quickAddBusy = ref(false)
const quickAddError = ref('')
const quickAddName = computed(() => {
  try {
    const url = new URL(quickAddUrl.value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return ''
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
    return `${url.hostname.replace(/^www\./, '')}${path}`.slice(0, 200)
  } catch {
    return ''
  }
})
function openQuickAdd() {
  quickAddUrl.value = ''
  quickAddError.value = ''
  quickAddOpen.value = true
}
async function submitQuickAdd() {
  if (!quickAddName.value) {
    quickAddError.value = 'Enter a valid http(s) URL.'
    return
  }
  quickAddBusy.value = true
  quickAddError.value = ''
  try {
    await $fetch('/api/v1/monitors', {
      method: 'POST',
      body: {
        name: quickAddName.value,
        type: 'http',
        url: quickAddUrl.value.trim(),
        interval: 60,
        timeout: 10,
        method: 'GET',
        active: true,
      },
    })
    quickAddOpen.value = false
    toast.add({ title: 'Monitor added', description: `${quickAddName.value} is checked every 60 seconds.`, color: 'success' })
    await refresh()
  } catch (error: any) {
    quickAddError.value = error?.data?.message || error?.message || 'Could not add monitor.'
  } finally {
    quickAddBusy.value = false
  }
}

// View state
const viewMode = ref<'grid' | 'list'>('grid')
const searchQuery = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')

const {monitors,pending,error,page,summary:stats,next,back,canBack,refresh}=useMonitorPageForDashboard()
function useMonitorPageForDashboard(){const result=useMonitorPage();watch(searchQuery,value=>result.search.value=value);watch(statusFilter,value=>result.status.value=value);watch(typeFilter,value=>result.type.value=value);return result}
const monitorsWithLiveData=computed(()=>monitors.value.map((m:any)=>{const beats=heartbeatsMap.value[m.id]||m.heartbeats||[],latest=beats[0],fresh=latest&&Date.now()-new Date(latest.time).getTime()<=Math.max(m.interval*2,m.interval+m.timeout)*1000;return {...m,viewStatus:!m.active?'paused':!latest?'pending':!fresh?'stale':latest.status===1?'up':latest.status===0?'down':latest.status===3?'maintenance':'pending',heartbeats:beats}}))
const filteredMonitors=monitorsWithLiveData
const {data:eventData,refresh:refreshEvents}=await useFetch<any>('/api/v1/monitors/events',{headers:useRequestHeaders(['cookie'])})
let historySequence=0
watch(monitors,async rows=>{
  if(import.meta.server)return
  const sequence=++historySequence,ids=rows.map((row:any)=>row.id),previous=heartbeatsMap.value,nextMap:Record<number,any[]>={};socket?.emit('subscribe_monitors',ids)
  for(const row of rows){const old=previous[row.id]||[],incoming=row.heartbeats||[];nextMap[row.id]=old[0]?.id&&(!incoming[0]?.id||BigInt(old[0].id)>=BigInt(incoming[0].id))?old:incoming}
  heartbeatsMap.value=nextMap
  if(!ids.length)return
  let response:any;try{response=await $fetch<any>('/api/v1/monitors/recent-heartbeats',{query:{ids:ids.join(','),limit:20}})}catch{return}
  if(sequence!==historySequence||ids.join(',')!==monitors.value.map((row:any)=>row.id).join(','))return
  for(const id of ids){const live=heartbeatsMap.value[id]||[],seen=new Set(live.map((beat:any)=>beat.id));heartbeatsMap.value[id]=[...live,...(response.data[id]||[]).filter((beat:any)=>!seen.has(beat.id))].sort((a:any,b:any)=>BigInt(a.id)>BigInt(b.id)?-1:1).slice(0,20)}
},{flush:'post',immediate:true})
const filterByStatus = (status: string) => {
  statusFilter.value = statusFilter.value === status ? 'all' : status
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = 'all'
  typeFilter.value = 'all'
}

const getLatestStatus = (monitor: any) => {
  if(monitor.viewStatus==='stale')return 2
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

const importantHeartbeats=computed<any[]>(()=>eventData.value?.data||[])

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
  if(monitor.viewStatus==='stale')return 'STALE'
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


onMounted(() => {
  if ($socket) {
    socket = $socket.connect()
    socketConnected.value=!!socket?.connected
    if(socket?.connected)socket.emit('subscribe_monitors',monitors.value.map((monitor:any)=>monitor.id))

    socket?.on('connect', () => {
      socketConnected.value = true
      console.log('[Dashboard] Socket connected')

      // Subscribe to monitor updates
      socket?.emit('subscribe_monitors',monitors.value.map((monitor:any)=>monitor.id))
    })

    socket?.on('disconnect', () => {
      socketConnected.value = false
      console.log('[Dashboard] Socket disconnected')
    })

    // Handle heartbeat updates
    socket?.on('heartbeat', (data: any) => {
      console.log('[Dashboard] Heartbeat received:', data)
      const { monitorId, heartbeat } = data
      if(!monitors.value.some((monitor:any)=>monitor.id===monitorId))return
      const current=heartbeatsMap.value[monitorId]?.[0]
      try{if(current?.id&&BigInt(heartbeat.id)<=BigInt(current.id))return}catch{}


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

// Auto-refresh interval reference
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Auto-refresh every 30 seconds as fallback
  refreshInterval=setInterval(()=>{refresh();refreshEvents()},15000)
})

onUnmounted(() => {
  if (socket) {
    socket.emit('unsubscribe_monitors')
    $socket?.disconnect()
  }
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

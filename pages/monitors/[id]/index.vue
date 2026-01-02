<template>
  <div class="page-container max-w-6xl">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-[400px]">
      <div class="spinner w-10 h-10"></div>
    </div>

    <Transition name="slide-fade">
    <div v-if="monitor && !loading">
      <!-- Header -->
      <div class="mb-6">
        <NuxtLink to="/dashboard" class="link inline-flex items-center mb-3 group">
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </NuxtLink>
        
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-gray-100">{{ monitor.name }}</h1>
              <span class="text-gray-500 text-sm">#{{ monitor.id }}</span>
              <span 
                :class="[statusBadgeClass, latestStatus === 1 ? 'status-up' : latestStatus === 0 ? 'status-down' : '']" 
                class="badge text-sm px-3 py-1"
              >
                {{ statusText }}
              </span>
            </div>
            <p v-if="monitor.description" class="text-gray-400 mt-1">{{ monitor.description }}</p>
            <div class="flex items-center gap-2 mt-2 text-sm text-gray-400">
              <span class="uppercase font-medium text-gray-300">{{ monitor.type }}</span>
              <span>|</span>
              <a v-if="monitor.url" :href="monitor.url" target="_blank" class="link truncate max-w-md">
                {{ monitor.url }}
              </a>
              <span v-else-if="monitor.hostname">{{ monitor.hostname }}{{ monitor.port ? `:${monitor.port}` : '' }}</span>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center gap-2 flex-wrap">
            <button v-if="monitor.active" @click="pauseMonitor" class="btn btn-secondary">
              <UIcon name="i-heroicons-pause" class="w-4 h-4 mr-1" />
              Pause
            </button>
            <button v-else @click="resumeMonitor" class="btn btn-primary">
              <UIcon name="i-heroicons-play" class="w-4 h-4 mr-1" />
              Resume
            </button>
            <NuxtLink :to="`/monitors/${monitorId}/edit`" class="btn btn-secondary">
              <UIcon name="i-heroicons-pencil" class="w-4 h-4 mr-1" />
              Edit
            </NuxtLink>
            <button @click="cloneMonitor" class="btn btn-secondary" :disabled="cloning">
              <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4 mr-1" />
              {{ cloning ? "Cloning..." : "Clone" }}
            </button>
            <button @click="showDeleteConfirm = true" class="btn btn-danger">
              <UIcon name="i-heroicons-trash" class="w-4 h-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <Transition name="fade">
      <div v-if="monitor.tags?.length" class="flex flex-wrap gap-2 mb-6">
        <span 
          v-for="mt in monitor.tags" 
          :key="mt.tag?.id || mt.id" 
          class="px-2 py-1 rounded text-xs font-medium text-white transition-transform hover:scale-105"
          :style="{ backgroundColor: mt.tag?.color || mt.color }"
        >
          {{ mt.tag?.name || mt.name }}
        </span>
      </div>
      </Transition>

      <!-- Status & Heartbeat Bar -->
      <div class="card card-body mb-6 card-interactive">
        <div class="flex flex-col lg:flex-row lg:items-center gap-6">
          <div class="flex-1">
            <h3 class="text-sm font-medium text-gray-400 mb-2">Heartbeat History</h3>
            <div class="flex items-center gap-0.5">
              <div
                v-for="(beat, i) in displayHeartbeats"
                :key="i"
                class="heartbeat-bar h-8 w-1.5 rounded-full cursor-pointer"
                :class="[getHeartbeatClass(beat), i === displayHeartbeats.length - 1 && beat?.status === 1 ? 'pulse' : '']"
                :style="{ animationDelay: `${i * 20}ms` }"
                :title="beat ? `${formatDateTime(beat.time)} - ${beat.ping || 0}ms` : 'No data'"
              ></div>
            </div>
            <p class="text-xs text-gray-500 mt-2">Check every {{ monitor.interval }} seconds</p>
          </div>
          <div class="text-center lg:text-right">
            <div 
              class="text-5xl font-bold transition-all duration-300" 
              :class="[statusColorClass, latestStatus === 1 ? 'glow-green' : latestStatus === 0 ? 'glow-red' : '']"
            >
              {{ statusText }}
            </div>
            <p v-if="lastHeartbeat" class="text-sm text-gray-400 mt-1">
              Last check: {{ formatDateTime(lastHeartbeat.time) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Statistics Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-400 mb-1">Response Time</div>
          <div class="stat-value text-2xl font-bold text-emerald-400" :key="lastPing">
            <span class="tabular-nums">{{ animatedPing }}</span><span class="text-lg">ms</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">Current</div>
        </div>
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-400 mb-1">Avg Response</div>
          <div class="stat-value text-2xl font-bold text-blue-400">
            <span class="tabular-nums">{{ avgPing }}</span><span class="text-lg">ms</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">24-hour</div>
        </div>
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-400 mb-1">Uptime</div>
          <div class="stat-value text-2xl font-bold" :class="uptime24hColor">
            <span class="tabular-nums">{{ uptime24h }}</span><span class="text-lg">%</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">24-hour</div>
        </div>
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-400 mb-1">Uptime</div>
          <div class="stat-value text-2xl font-bold" :class="uptime30dColor">
            <span class="tabular-nums">{{ uptime30d }}</span><span class="text-lg">%</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">30-day</div>
        </div>
      </div>

      <!-- Response Time Chart -->
      <div class="card card-body mb-6">
        <h3 class="text-lg font-semibold text-gray-100 mb-4">Response Time (Last 24 Hours)</h3>
        <div class="h-48 relative pl-14">
          <div class="absolute inset-0 pl-14 flex items-end gap-0.5">
            <div
              v-for="(beat, i) in chartHeartbeats"
              :key="i"
              class="chart-bar flex-1 rounded-t transition-all hover:opacity-80 cursor-pointer"
              :class="beat?.status === 1 ? 'bg-emerald-500' : beat?.status === 0 ? 'bg-red-500' : 'bg-gray-700'"
              :style="{ 
                height: getChartHeight(beat),
                animationDelay: `${i * 10}ms`
              }"
              :title="beat ? `${formatDateTime(beat.time)}: ${beat.ping || 0}ms` : 'No data'"
            ></div>
          </div>
          <!-- Y-axis labels -->
          <div class="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500">
            <span>{{ maxPing }}ms</span>
            <span>{{ Math.round(maxPing / 2) }}ms</span>
            <span>0ms</span>
          </div>
        </div>
      </div>

      <!-- TLS Certificate Info (for HTTPS monitors) -->
      <div v-if="showTlsInfo" class="card card-body mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-100">TLS/SSL Certificate</h3>
          <button @click="refreshCertInfo" class="btn btn-secondary btn-sm" :disabled="loadingCert">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" :class="{ 'animate-spin': loadingCert }" />
          </button>
        </div>
        
        <div v-if="loadingCert" class="flex items-center justify-center py-8">
          <div class="spinner w-6 h-6"></div>
        </div>
        
        <div v-else-if="certInfo && certInfo.hasCertificate" class="space-y-4">
          <!-- Certificate Status -->
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg" :class="certStatusClass">
              <UIcon :name="certStatusIcon" class="w-8 h-8" />
            </div>
            <div>
              <div class="font-medium text-gray-100">
                {{ certInfo.certificate.valid ? 'Valid Certificate' : 'Invalid Certificate' }}
              </div>
              <div class="text-sm" :class="certDaysClass">
                {{ certDaysMessage }}
              </div>
            </div>
          </div>

          <!-- Certificate Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Subject</div>
              <div class="text-sm text-gray-300 font-mono break-all">{{ certInfo.certificate.subject }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Issuer</div>
              <div class="text-sm text-gray-300 font-mono break-all">{{ certInfo.certificate.issuer }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Valid From</div>
              <div class="text-sm text-gray-300">{{ formatDate(certInfo.certificate.validFrom) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Valid To</div>
              <div class="text-sm text-gray-300">{{ formatDate(certInfo.certificate.validTo) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Days Remaining</div>
              <div class="text-sm font-bold" :class="certDaysClass">{{ certInfo.certificate.daysRemaining }} days</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Fingerprint</div>
              <div class="text-sm text-gray-300 font-mono truncate">{{ certInfo.certificate.fingerprint }}</div>
            </div>
          </div>

          <!-- Subject Alt Names -->
          <div v-if="certInfo.certificate.subjectAltName?.length" class="pt-4 border-t border-gray-700">
            <div class="text-xs text-gray-500 uppercase mb-2">Subject Alternative Names</div>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="(san, idx) in certInfo.certificate.subjectAltName" 
                :key="idx"
                class="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 font-mono"
              >
                {{ san }}
              </span>
            </div>
          </div>
        </div>
        
        <div v-else class="text-center py-8 text-gray-500">
          <UIcon name="i-heroicons-shield-exclamation" class="w-8 h-8 mx-auto mb-2" />
          <p>{{ certInfo?.message || 'Unable to retrieve certificate information' }}</p>
        </div>
      </div>

      <!-- Important Events Table -->
      <div class="card mb-6">
        <div class="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-100">Important Events</h3>
          <span class="text-sm text-gray-400">{{ importantHeartbeats.length }} events</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>DateTime</th>
                <th>Response</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(beat, index) in paginatedHeartbeats" :key="index" class="hover:bg-gray-700/50">
                <td>
                  <span :class="getStatusBadgeClass(beat.status)" class="badge">
                    {{ getStatusText(beat.status) }}
                  </span>
                </td>
                <td class="text-gray-400">{{ formatDateTime(beat.time) }}</td>
                <td class="text-gray-400">{{ beat.ping ? `${beat.ping}ms` : '-' }}</td>
                <td class="text-gray-400 max-w-xs truncate">{{ beat.msg || '-' }}</td>
              </tr>
              <tr v-if="importantHeartbeats.length === 0">
                <td colspan="4" class="text-center text-gray-500 py-8">
                  <UIcon name="i-heroicons-check-circle" class="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p>No important events</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-4 p-4 border-t border-gray-700">
          <button 
            @click="currentPage--" 
            :disabled="currentPage <= 1"
            class="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span class="text-sm text-gray-400">Page {{ currentPage }} of {{ totalPages }}</span>
          <button 
            @click="currentPage++" 
            :disabled="currentPage >= totalPages"
            class="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Transition name="fade">
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDeleteConfirm = false">
      <Transition name="scale">
      <div class="card card-body max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold text-gray-100 mb-4">Delete Monitor</h3>
        <p class="text-gray-400 mb-6">Are you sure you want to delete "{{ monitor?.name }}"? This action cannot be undone.</p>
        <div class="flex justify-end gap-3">
          <button @click="showDeleteConfirm = false" class="btn btn-secondary">Cancel</button>
          <button @click="confirmDelete" :disabled="deleting" class="btn btn-danger">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
      </Transition>
    </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { $socket } = useNuxtApp()

const monitorId = computed(() => Number(route.params.id))
const monitor = ref<any>(null)
const heartbeats = ref<any[]>([])
const loading = ref(true)
const deleting = ref(false)
const cloning = ref(false)
const showDeleteConfirm = ref(false)
const currentPage = ref(1)
const perPage = 25

// TLS Certificate info
const certInfo = ref<any>(null)
const loadingCert = ref(false)

// Show TLS info only for HTTPS monitors
const showTlsInfo = computed(() => {
  return monitor.value?.url?.startsWith('https://')
})

// Cert status classes
const certStatusClass = computed(() => {
  if (!certInfo.value?.certificate) return 'bg-gray-700'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0) return 'bg-red-600/20 text-red-400'
  if (days <= 7) return 'bg-red-600/20 text-red-400'
  if (days <= 14) return 'bg-orange-600/20 text-orange-400'
  if (days <= 30) return 'bg-yellow-600/20 text-yellow-400'
  return 'bg-emerald-600/20 text-emerald-400'
})

const certStatusIcon = computed(() => {
  if (!certInfo.value?.certificate) return 'i-heroicons-shield-exclamation'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0 || !certInfo.value.certificate.valid) return 'i-heroicons-x-circle'
  if (days <= 14) return 'i-heroicons-exclamation-triangle'
  return 'i-heroicons-shield-check'
})

const certDaysClass = computed(() => {
  if (!certInfo.value?.certificate) return 'text-gray-400'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0) return 'text-red-400'
  if (days <= 7) return 'text-red-400'
  if (days <= 14) return 'text-orange-400'
  if (days <= 30) return 'text-yellow-400'
  return 'text-emerald-400'
})

const certDaysMessage = computed(() => {
  if (!certInfo.value?.certificate) return 'Unknown'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0) return `Expired ${Math.abs(days)} days ago`
  if (days === 0) return 'Expires today!'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
})

const refreshCertInfo = async () => {
  if (!showTlsInfo.value) return
  loadingCert.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/certificate`)
    certInfo.value = res
  } catch (error) {
    console.error('Failed to fetch certificate info:', error)
  } finally {
    loadingCert.value = false
  }
}

const formatDate = (date: string | Date | null) => {
  if (!date) return 'N/A'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

// Fetch data
onMounted(async () => {
  try {
    const [monitorRes, heartbeatsRes] = await Promise.all([
      $fetch<any>(`/api/v1/monitors/${monitorId.value}`),
      $fetch<any>(`/api/v1/monitors/${monitorId.value}/heartbeats?hours=24`)
    ])
    monitor.value = monitorRes.data || monitorRes
    heartbeats.value = heartbeatsRes.data || heartbeatsRes || []
    
    // Fetch certificate info for HTTPS monitors
    if (monitor.value?.url?.startsWith('https://')) {
      refreshCertInfo()
    }
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to load monitor', color: 'error' })
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
  
  // WebSocket subscription
  if ($socket) {
    const socket = $socket.connect()
    socket?.emit('subscribe_monitor', monitorId.value)
    
    socket?.on('heartbeat', (data: any) => {
      if (data.monitorId === monitorId.value) {
        // Add new heartbeat with animation flag
        const newHeartbeat = { ...data.heartbeat, isNew: true }
        heartbeats.value.unshift(newHeartbeat)
        
        // Remove animation flag after animation completes
        setTimeout(() => {
          if (heartbeats.value[0]?.id === newHeartbeat.id) {
            heartbeats.value[0].isNew = false
          }
        }, 500)
        
        // Keep max 1000 heartbeats
        if (heartbeats.value.length > 1000) {
          heartbeats.value = heartbeats.value.slice(0, 1000)
        }
        
        console.log(`[Socket] Received heartbeat for monitor ${data.monitorId}: status=${data.heartbeat.status}`)
      }
    })
    
    socket?.on('connect', () => {
      console.log('[Socket] Connected, subscribing to monitor', monitorId.value)
      socket?.emit('subscribe_monitor', monitorId.value)
    })
  }
})

onUnmounted(() => {
  if ($socket) {
    const socket = $socket.getSocket()
    socket?.emit('unsubscribe_monitor', monitorId.value)
  }
})

// Computed
const lastHeartbeat = computed(() => heartbeats.value[0])

// Latest status for animation classes
const latestStatus = computed(() => lastHeartbeat.value?.status ?? null)

// Animated ping value with transition effect
const animatedPing = ref(0)
watch(() => lastHeartbeat.value?.ping, (newPing) => {
  if (newPing !== undefined && newPing !== null) {
    // Animate the ping value
    const start = animatedPing.value
    const end = newPing
    const duration = 300
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      animatedPing.value = Math.round(start + (end - start) * progress)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    animate()
  }
}, { immediate: true })

const statusText = computed(() => {
  if (!monitor.value?.active) return 'PAUSED'
  if (!lastHeartbeat.value) return 'PENDING'
  switch (lastHeartbeat.value.status) {
    case 1: return 'UP'
    case 0: return 'DOWN'
    case 3: return 'MAINTENANCE'
    default: return 'UNKNOWN'
  }
})

const statusBadgeClass = computed(() => {
  if (!monitor.value?.active) return 'bg-gray-600'
  if (!lastHeartbeat.value) return 'bg-yellow-600'
  switch (lastHeartbeat.value.status) {
    case 1: return 'badge-success'
    case 0: return 'badge-danger'
    case 3: return 'badge-info'
    default: return 'bg-gray-600'
  }
})

const statusColorClass = computed(() => {
  if (!monitor.value?.active) return 'text-gray-400'
  if (!lastHeartbeat.value) return 'text-yellow-400'
  switch (lastHeartbeat.value.status) {
    case 1: return 'text-emerald-400'
    case 0: return 'text-red-400'
    case 3: return 'text-blue-400'
    default: return 'text-gray-400'
  }
})

const lastPing = computed(() => lastHeartbeat.value?.ping || 0)

const avgPing = computed(() => {
  const beats = heartbeats.value.filter(h => h.ping > 0)
  if (beats.length === 0) return 0
  return Math.round(beats.reduce((a, b) => a + b.ping, 0) / beats.length)
})

const maxPing = computed(() => {
  const max = Math.max(...heartbeats.value.map(h => h.ping || 0), 100)
  return Math.ceil(max / 100) * 100
})

const uptime24h = computed(() => {
  const now = Date.now()
  const beats = heartbeats.value.filter(h => new Date(h.time).getTime() > now - 24 * 60 * 60 * 1000)
  if (beats.length === 0) return '0.00'
  const up = beats.filter(h => h.status === 1).length
  return ((up / beats.length) * 100).toFixed(2)
})

const uptime30d = computed(() => {
  const now = Date.now()
  const beats = heartbeats.value.filter(h => new Date(h.time).getTime() > now - 30 * 24 * 60 * 60 * 1000)
  if (beats.length === 0) return '0.00'
  const up = beats.filter(h => h.status === 1).length
  return ((up / beats.length) * 100).toFixed(2)
})

const uptime24hColor = computed(() => {
  const val = parseFloat(uptime24h.value)
  if (val >= 99) return 'text-emerald-400'
  if (val >= 95) return 'text-yellow-400'
  return 'text-red-400'
})

const uptime30dColor = computed(() => {
  const val = parseFloat(uptime30d.value)
  if (val >= 99) return 'text-emerald-400'
  if (val >= 95) return 'text-yellow-400'
  return 'text-red-400'
})

const displayHeartbeats = computed(() => {
  const result = []
  for (let i = 0; i < 50; i++) {
    result.push(heartbeats.value[i] || null)
  }
  return result.reverse()
})

const chartHeartbeats = computed(() => {
  const result = []
  for (let i = 0; i < 100; i++) {
    result.push(heartbeats.value[i] || null)
  }
  return result.reverse()
})

const importantHeartbeats = computed(() => {
  return heartbeats.value.filter(h => h.important || h.status === 0 || h.status === 3)
})

const totalPages = computed(() => Math.ceil(importantHeartbeats.value.length / perPage))

const paginatedHeartbeats = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return importantHeartbeats.value.slice(start, start + perPage)
})

// Methods
const formatDateTime = (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')

const getChartHeight = (beat: any) => {
  if (!beat || !beat.ping) return '5%'
  const percentage = Math.min((beat.ping / maxPing.value) * 100, 100)
  return `${Math.max(percentage, 5)}%`
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

const getStatusBadgeClass = (status: number) => {
  switch (status) {
    case 1: return 'badge-success'
    case 0: return 'badge-danger'
    case 3: return 'badge-info'
    default: return 'bg-gray-600'
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

const pauseMonitor = async () => {
  try {
    await $fetch(`/api/v1/monitors/${monitorId.value}/pause`, { method: 'POST' })
    monitor.value.active = false
    toast.add({ title: 'Monitor paused', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to pause', color: 'error' })
  }
}

const resumeMonitor = async () => {
  try {
    await $fetch(`/api/v1/monitors/${monitorId.value}/resume`, { method: 'POST' })
    monitor.value.active = true
    toast.add({ title: 'Monitor resumed', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to resume', color: 'error' })
  }
}

const cloneMonitor = async () => {
  cloning.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/clone`, { method: 'POST' })
    toast.add({ title: 'Monitor cloned', description: 'Redirecting to cloned monitor...', color: 'success' })
    router.push(`/monitors/${res.data.id}`)
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to clone', color: 'error' })
  } finally {
    cloning.value = false
  }
}

const confirmDelete = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/v1/monitors/${monitorId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Monitor deleted', color: 'success' })
    router.push('/dashboard')
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to delete', color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

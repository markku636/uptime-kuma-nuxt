<script setup lang="ts">
import { io, Socket } from 'socket.io-client'

// Public status page - no auth required
definePageMeta({
  layout: false
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const statusPage = ref<any>(null)
const monitors = ref<any[]>([])
const incidents = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const lastUpdated = ref<Date | null>(null)

// WebSocket for real-time updates
let socket: Socket | null = null

onMounted(async () => {
  try {
    const data = await $fetch(`/api/v1/status-pages/${slug.value}`) as any
    statusPage.value = data.statusPage
    monitors.value = data.monitors || []
    incidents.value = data.incidents || []
    lastUpdated.value = new Date()
    
    // Apply custom CSS if present
    if (statusPage.value?.customCss) {
      const styleEl = document.createElement('style')
      styleEl.textContent = statusPage.value.customCss
      styleEl.id = 'custom-status-page-css'
      document.head.appendChild(styleEl)
    }
    
    // Set page title
    if (statusPage.value?.title) {
      document.title = `${statusPage.value.title} - Status`
    }
    
    // Connect to WebSocket for real-time updates
    initializeWebSocket()
  } catch (e: any) {
    error.value = e.data?.message || 'Status page not found'
  } finally {
    loading.value = false
  }
})

function initializeWebSocket() {
  // Connect to socket
  socket = io(window.location.origin, {
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  })
  
  socket.on('connect', () => {
    console.log('[Status Page] WebSocket connected')
    // Subscribe to status page updates
    socket?.emit('subscribe_status_page', slug.value)
    
    // Subscribe to all monitors on this status page
    monitors.value.forEach(m => {
      socket?.emit('subscribe_monitor', m.id)
    })
  })
  
  socket.on('heartbeat', (data: any) => {
    // Update the specific monitor's heartbeat
    const monitorIndex = monitors.value.findIndex(m => m.id === data.monitorId)
    if (monitorIndex !== -1) {
      // Add new heartbeat to the beginning
      if (!monitors.value[monitorIndex].heartbeats) {
        monitors.value[monitorIndex].heartbeats = []
      }
      monitors.value[monitorIndex].heartbeats.unshift(data.heartbeat)
      // Keep only last 90 heartbeats
      if (monitors.value[monitorIndex].heartbeats.length > 90) {
        monitors.value[monitorIndex].heartbeats = monitors.value[monitorIndex].heartbeats.slice(0, 90)
      }
      lastUpdated.value = new Date()
    }
  })
  
  socket.on('incident_created', (incident: any) => {
    if (incident.statusPageId === statusPage.value?.id) {
      incidents.value.unshift(incident)
    }
  })
  
  socket.on('incident_updated', (incident: any) => {
    const idx = incidents.value.findIndex(i => i.id === incident.id)
    if (idx !== -1) {
      incidents.value[idx] = incident
    }
  })
  
  socket.on('disconnect', () => {
    console.log('[Status Page] WebSocket disconnected')
  })
}

// Cleanup on unmount
onUnmounted(() => {
  // Remove custom CSS
  const styleEl = document.getElementById('custom-status-page-css')
  if (styleEl) {
    styleEl.remove()
  }
  
  // Disconnect WebSocket
  if (socket) {
    socket.disconnect()
    socket = null
  }
})

// Calculate overall status
const overallStatus = computed(() => {
  if (monitors.value.length === 0) return 'unknown'
  
  const downMonitors = monitors.value.filter(m => {
    const lastHeartbeat = m.heartbeats?.[0]
    return lastHeartbeat && lastHeartbeat.status !== 1
  })
  
  if (downMonitors.length === 0) return 'operational'
  if (downMonitors.length === monitors.value.length) return 'major-outage'
  return 'partial-outage'
})

const overallStatusConfig = computed(() => {
  switch (overallStatus.value) {
    case 'operational':
      return { text: 'All Systems Operational', color: 'text-green-500', bg: 'bg-green-500' }
    case 'partial-outage':
      return { text: 'Partial System Outage', color: 'text-yellow-500', bg: 'bg-yellow-500' }
    case 'major-outage':
      return { text: 'Major System Outage', color: 'text-red-500', bg: 'bg-red-500' }
    default:
      return { text: 'Status Unknown', color: 'text-gray-500', bg: 'bg-gray-500' }
  }
})

function getMonitorStatus(monitor: any) {
  const lastHeartbeat = monitor.heartbeats?.[0]
  if (!lastHeartbeat) return { text: 'Unknown', color: 'gray' }
  return lastHeartbeat.status === 1
    ? { text: 'Operational', color: 'green' }
    : { text: 'Down', color: 'red' }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatLastUpdated(date: Date | null) {
  if (!date) return ''
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 status-page">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500">Loading status page...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-300 mb-4">404</h1>
        <p class="text-gray-500">{{ error }}</p>
      </div>
    </div>

    <!-- Status Page -->
    <div v-else class="max-w-4xl mx-auto px-4 py-12 status-page-content">
      <!-- Header -->
      <header class="text-center mb-12 status-page-header">
        <img
          v-if="statusPage.icon"
          :src="statusPage.icon"
          :alt="statusPage.title"
          class="w-16 h-16 mx-auto mb-4 rounded-lg status-page-logo"
        />
        <h1 class="text-3xl font-bold mb-2 status-page-title">{{ statusPage.title }}</h1>
        <p v-if="statusPage.description" class="text-gray-600 dark:text-gray-400 status-page-description">
          {{ statusPage.description }}
        </p>
        <!-- Last Updated indicator -->
        <div v-if="lastUpdated" class="mt-4 text-sm text-gray-500 flex items-center justify-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span>Real-time updates • Last updated: {{ formatLastUpdated(lastUpdated) }}</span>
        </div>
      </header>

      <!-- Overall Status Banner -->
      <div
        :class="[
          'rounded-lg p-6 mb-8 text-center text-white',
          overallStatusConfig.bg
        ]"
      >
        <div class="flex items-center justify-center gap-2 text-xl font-semibold">
          <span
            v-if="overallStatus === 'operational'"
            class="text-2xl"
          >✓</span>
          <span
            v-else-if="overallStatus === 'partial-outage'"
            class="text-2xl"
          >⚠</span>
          <span v-else class="text-2xl">✕</span>
          {{ overallStatusConfig.text }}
        </div>
      </div>

      <!-- Monitors -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-8">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="font-semibold">Services</h2>
        </div>
        
        <div v-if="monitors.length === 0" class="p-8 text-center text-gray-500">
          No monitors configured for this status page.
        </div>
        
        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="monitor in monitors"
            :key="monitor.id"
            class="p-4 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <span
                :class="[
                  'w-3 h-3 rounded-full',
                  getMonitorStatus(monitor).color === 'green' ? 'bg-green-500' :
                  getMonitorStatus(monitor).color === 'red' ? 'bg-red-500' : 'bg-gray-400'
                ]"
              ></span>
              <span class="font-medium">{{ monitor.name }}</span>
            </div>
            <span
              :class="[
                'text-sm',
                getMonitorStatus(monitor).color === 'green' ? 'text-green-500' :
                getMonitorStatus(monitor).color === 'red' ? 'text-red-500' : 'text-gray-500'
              ]"
            >
              {{ getMonitorStatus(monitor).text }}
            </span>
          </div>
        </div>
      </div>

      <!-- Heartbeat History -->
      <div
        v-for="monitor in monitors"
        :key="`history-${monitor.id}`"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4"
      >
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-medium">{{ monitor.name }} - 90 Day History</h3>
        </div>
        <div class="p-4">
          <div class="flex gap-0.5">
            <div
              v-for="(beat, index) in (monitor.heartbeats || []).slice(0, 90)"
              :key="index"
              :class="[
                'flex-1 h-8 rounded-sm',
                beat.status === 1 ? 'bg-green-500' : 'bg-red-500'
              ]"
              :title="`${new Date(beat.time).toLocaleDateString()}: ${beat.status === 1 ? 'Up' : 'Down'}`"
            ></div>
            <!-- Fill empty slots -->
            <div
              v-for="i in Math.max(0, 90 - (monitor.heartbeats?.length || 0))"
              :key="`empty-${i}`"
              class="flex-1 h-8 rounded-sm bg-gray-200 dark:bg-gray-700"
            ></div>
          </div>
          <div class="flex justify-between text-xs text-gray-500 mt-2">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      <!-- Incidents -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="font-semibold">Incidents</h2>
        </div>
        
        <div v-if="incidents.length === 0" class="p-8 text-center text-gray-500">
          No incidents reported.
        </div>
        
        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="incident in incidents"
            :key="incident.id"
            class="p-4"
          >
            <div class="flex items-start gap-3">
              <span
                :class="[
                  'w-3 h-3 rounded-full mt-1.5 flex-shrink-0',
                  incident.style === 'danger' ? 'bg-red-500' :
                  incident.style === 'warning' ? 'bg-yellow-500' :
                  incident.style === 'info' ? 'bg-blue-500' : 'bg-green-500'
                ]"
              ></span>
              <div>
                <h3 class="font-medium">{{ incident.title }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ incident.content }}
                </p>
                <p class="text-xs text-gray-500 mt-2">
                  {{ formatDate(incident.createdAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="text-center mt-12 text-sm text-gray-500 status-page-footer">
        <p v-if="statusPage.footerText" class="mb-2">
          {{ statusPage.footerText }}
        </p>
        <p v-if="statusPage.showPoweredBy !== false">
          Powered by
          <a href="https://github.com/louislam/uptime-kuma" target="_blank" class="text-primary-500 hover:underline">
            Uptime Kuma
          </a>
        </p>
      </footer>
    </div>

    <!-- Google Analytics -->
    <component 
      v-if="statusPage?.googleAnalyticsId" 
      :is="'script'" 
      async 
      :src="`https://www.googletagmanager.com/gtag/js?id=${statusPage.googleAnalyticsId}`"
    />
    <component 
      v-if="statusPage?.googleAnalyticsId" 
      :is="'script'"
    >
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '{{ statusPage.googleAnalyticsId }}');
    </component>
  </div>
</template>

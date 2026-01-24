/**
 * Composable for public status page functionality
 * Used in /status/[slug] page
 */

interface StatusPageConfig {
  slug: string
  title: string
  description?: string
  icon: string
  theme: 'auto' | 'light' | 'dark'
  autoRefreshInterval: number
  published: boolean
  showTags: boolean
  showPoweredBy: boolean
  showCertificateExpiry: boolean
  customCSS?: string
  footerText?: string
  googleAnalyticsId?: string
}

interface Incident {
  id?: number
  title: string
  content: string
  style: 'info' | 'warning' | 'danger' | 'primary' | 'light' | 'dark'
  pin: boolean
  createdDate?: string
  lastUpdatedDate?: string
}

interface Heartbeat {
  status: number
  time: string
  ping?: number
  msg?: string
}

interface Tag {
  id: number
  name: string
  color?: string
}

interface PublicMonitor {
  id: number
  name: string
  sendUrl?: boolean
  url?: string
  type?: string
  tags?: Tag[]
  heartbeats?: Heartbeat[]
  uptime24?: number
  validCert?: boolean
  certExpiryDaysRemaining?: number
}

interface PublicGroup {
  id: number
  name: string
  weight: number
  monitorList: PublicMonitor[]
}

interface GroupTab {
  id: number
  name: string
  count: number
}

interface Pagination {
  total: number
  currentPage: number
  totalPages: number
  perPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface Maintenance {
  id: number
  title: string
  description?: string
  // TODO: Add more fields as needed
}

// Overall status constants
const STATUS_PAGE_ALL_UP = 0
const STATUS_PAGE_PARTIAL_DOWN = 1
const STATUS_PAGE_ALL_DOWN = 2
const STATUS_PAGE_MAINTENANCE = 3

export function usePublicStatusPage(slug: Ref<string> | string) {
  const slugRef = isRef(slug) ? slug : ref(slug)
  
  // State
  const config = ref<StatusPageConfig | null>(null)
  const groups = ref<PublicGroup[]>([])
  const incident = ref<Incident | null>(null)
  const maintenanceList = ref<Maintenance[]>([])
  const heartbeatList = ref<Record<number, Heartbeat[]>>({})
  const uptimeList = ref<Record<string, number>>({})
  const groupTabs = ref<GroupTab[]>([])
  const pagination = ref<Pagination | null>(null)
  
  // UI State
  const loading = ref(true)
  const error = ref<string | null>(null)
  const activeTab = ref<number | null>(null)
  const page = ref(1)
  const perPage = ref(10)
  const lastUpdateTime = ref<Date | null>(null)
  const updateCountdownText = ref('')
  
  // Intervals
  let refreshInterval: ReturnType<typeof setInterval> | null = null
  let countdownInterval: ReturnType<typeof setInterval> | null = null

  // Computed
  const overallStatus = computed(() => {
    const allHeartbeats: Heartbeat[] = []
    
    for (const group of groups.value) {
      for (const monitor of group.monitorList) {
        if (monitor.heartbeats?.length) {
          allHeartbeats.push(monitor.heartbeats[monitor.heartbeats.length - 1])
        }
      }
    }
    
    if (allHeartbeats.length === 0) return -1
    
    let status = STATUS_PAGE_ALL_UP
    let hasUp = false
    
    for (const beat of allHeartbeats) {
      if (beat.status === 3) { // Maintenance
        return STATUS_PAGE_MAINTENANCE
      } else if (beat.status === 1) { // Up
        hasUp = true
      } else {
        status = STATUS_PAGE_PARTIAL_DOWN
      }
    }
    
    if (!hasUp) {
      status = STATUS_PAGE_ALL_DOWN
    }
    
    return status
  })

  const overallStatusType = computed(() => {
    switch (overallStatus.value) {
      case STATUS_PAGE_ALL_UP: return 'operational'
      case STATUS_PAGE_PARTIAL_DOWN: return 'partial-outage'
      case STATUS_PAGE_ALL_DOWN: return 'major-outage'
      case STATUS_PAGE_MAINTENANCE: return 'maintenance'
      default: return 'unknown'
    }
  })

  const totalMonitors = computed(() => {
    return groups.value.reduce((sum, group) => sum + group.monitorList.length, 0)
  })

  // Methods
  async function loadData(options: { noPagination?: boolean } = {}) {
    try {
      loading.value = true
      error.value = null

      const params = new URLSearchParams()
      
      if (options.noPagination) {
        params.append('no_pagination', 'true')
      } else {
        if (activeTab.value) {
          params.append('group', String(activeTab.value))
        }
        params.append('page', String(page.value))
        params.append('limit', String(perPage.value))
      }

      const url = `/api/v1/status-pages/${slugRef.value}/monitors${params.toString() ? '?' + params.toString() : ''}`
      const response = await $fetch<any>(url)

      if (response.ok && response.data) {
        config.value = response.data.config
        incident.value = response.data.incident
        groups.value = response.data.publicGroupList || []
        groupTabs.value = response.data.groupTabs || []
        pagination.value = response.data.pagination
        
        // Auto-select first tab if not set
        if (!activeTab.value && groupTabs.value.length > 0) {
          activeTab.value = groupTabs.value[0].id
        }
      }
    } catch (e: any) {
      error.value = e.data?.message || e.message || 'Failed to load status page'
      console.error('Failed to load status page:', e)
    } finally {
      loading.value = false
    }
  }

  async function loadHeartbeat(monitorIds?: number[]) {
    try {
      const params = new URLSearchParams()
      
      if (monitorIds?.length) {
        params.append('monitorIds', monitorIds.join(','))
      }

      const url = `/api/v1/status-pages/${slugRef.value}/heartbeat${params.toString() ? '?' + params.toString() : ''}`
      const response = await $fetch<any>(url)

      if (response.ok && response.data) {
        heartbeatList.value = response.data.heartbeatList || {}
        uptimeList.value = response.data.uptimeList || {}
        
        // Merge heartbeat data into groups
        for (const group of groups.value) {
          for (const monitor of group.monitorList) {
            if (heartbeatList.value[monitor.id]) {
              monitor.heartbeats = heartbeatList.value[monitor.id]
            }
            const uptimeKey = `${monitor.id}_24`
            if (uptimeList.value[uptimeKey] !== undefined) {
              monitor.uptime24 = uptimeList.value[uptimeKey]
            }
          }
        }
        
        lastUpdateTime.value = new Date()
        updateCountdown()
      }
    } catch (e) {
      console.error('Failed to load heartbeat:', e)
    }
  }

  function switchTab(tabId: number) {
    if (activeTab.value === tabId) return
    
    activeTab.value = tabId
    page.value = 1
    loadData()
  }

  function changePage(newPage: number) {
    if (page.value === newPage) return
    
    page.value = newPage
    loadData().then(() => {
      // Load heartbeat for new page
      const monitorIds = groups.value.flatMap(g => g.monitorList.map(m => m.id))
      loadHeartbeat(monitorIds)
    })
  }

  function updateCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval)
    }
    
    const interval = (config.value?.autoRefreshInterval || 300) + 10
    
    countdownInterval = setInterval(() => {
      if (!lastUpdateTime.value) return
      
      const elapsed = (Date.now() - lastUpdateTime.value.getTime()) / 1000
      const remaining = Math.max(0, interval - elapsed)
      
      if (remaining <= 0) {
        updateCountdownText.value = '00:00'
      } else {
        const mins = Math.floor(remaining / 60)
        const secs = Math.floor(remaining % 60)
        updateCountdownText.value = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      }
    }, 1000)
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    
    const interval = ((config.value?.autoRefreshInterval || 300) + 10) * 1000
    
    refreshInterval = setInterval(() => {
      const monitorIds = groups.value.flatMap(g => g.monitorList.map(m => m.id))
      loadHeartbeat(monitorIds)
    }, interval)
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
  }

  // Initialization
  async function init() {
    await loadData()
    
    // Load heartbeat for initial monitors
    const monitorIds = groups.value.flatMap(g => g.monitorList.map(m => m.id))
    if (monitorIds.length) {
      await loadHeartbeat(monitorIds)
    }
    
    // Start auto-refresh
    startAutoRefresh()
  }

  // Cleanup
  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    // State
    config,
    groups,
    incident,
    maintenanceList,
    heartbeatList,
    uptimeList,
    groupTabs,
    pagination,
    
    // UI State
    loading,
    error,
    activeTab,
    page,
    perPage,
    lastUpdateTime,
    updateCountdownText,
    
    // Computed
    overallStatus,
    overallStatusType,
    totalMonitors,
    
    // Methods
    init,
    loadData,
    loadHeartbeat,
    switchTab,
    changePage,
    startAutoRefresh,
    stopAutoRefresh
  }
}

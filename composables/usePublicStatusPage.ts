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
  perPage: number
  published: boolean
  showTags: boolean
  showPoweredBy: boolean
  showCertificateExpiry: boolean
  overallStatus?: string
  customCSS?: string
  footerText?: string
  googleAnalyticsId?: string
  noIndex?: boolean
  domainNameList?: string[]
  publicGroupList?: PublicGroup[]
  canEdit?: boolean
}

interface Incident {
  id?: number
  title: string
  content: string
  style: 'info' | 'warning' | 'danger' | 'primary' | 'light' | 'dark'
  pin: boolean
  createdDate?: string
  lastUpdatedDate?: string
  updates?: { id: number; status: string; message: string; createdDate: string }[]
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
  uptime30?: number
  uptime7?: number
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
  status?: string
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
  description?: string | null
  strategy: string
  status: string
  startDate?: string | null
  endDate?: string | null
  timeslotList?: { startDate: string; endDate: string }[]
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
  const incidents = ref<Incident[]>([])
  const maintenanceList = ref<Maintenance[]>([])
  const heartbeatList = ref<Record<number, Heartbeat[]>>({})
  const uptimeList = ref<Record<string, number>>({})
  const groupTabs = ref<GroupTab[]>([])
  const pagination = ref<Pagination | null>(null)
  
  // UI State
  const loading = ref(true)
  const error = ref<string | null>(null)
  const passwordRequired = ref(false)
  const passwordError = ref('')
  const activeTab = ref<number | null>(null)
  const page = ref(1)
  const search = ref('')
  const perPage = ref(5)
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
    // Backend computes this from all monitors on the page; fall back to the
    // current page aggregate for older cached responses.
    const serverStatus = config.value?.overallStatus
    if (serverStatus && ['operational', 'partial-outage', 'major-outage', 'maintenance', 'unknown'].includes(serverStatus)) return serverStatus
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

  watch(search, () => { page.value = 1; void loadData() })

  // Methods
  async function loadData(options: { noPagination?: boolean; groupId?: number } = {}) {
    try {
      loading.value = true
      error.value = null

      const params = new URLSearchParams()
      
      if (options.noPagination) {
        params.append('no_pagination', 'true')
      } else {
        // Use explicit groupId if provided, otherwise fall back to activeTab
        const groupIdToUse = options.groupId ?? activeTab.value
        if (groupIdToUse) {
          params.append('group', String(groupIdToUse))
          activeTab.value = groupIdToUse
        }
        params.append('page', String(page.value))
        params.append('limit', String(perPage.value))
        if (search.value.trim()) params.append('search', search.value.trim())
      }

      const url = `/api/v1/status-pages/${slugRef.value}/monitors${params.toString() ? '?' + params.toString() : ''}`
      const response = await $fetch<any>(url)

      if (response.ok && response.data) {
        config.value = response.data.config
        incident.value = response.data.incident
        incidents.value = response.data.incidents || (response.data.incident ? [response.data.incident] : [])
        groups.value = response.data.publicGroupList || []
        groupTabs.value = response.data.groupTabs || []
        pagination.value = response.data.pagination
        
        // Sync perPage from config (default to 5)
        if (config.value?.perPage) {
          perPage.value = config.value.perPage
        }
        
        // Auto-select first tab if not set
        if (!activeTab.value && groupTabs.value.length > 0) {
          activeTab.value = groupTabs.value[0].id
        }
      }
    } catch (e: any) {
      if (e?.statusCode === 401 && /password/i.test(e?.data?.message || e?.message || '')) {
        passwordRequired.value = true
        error.value = null
      } else {
        error.value = e.data?.message || e.message || 'Failed to load status page'
        console.error('Failed to load status page:', e)
      }
    } finally {
      loading.value = false
    }
  }

  async function loadMaintenance() {
    try {
      const response = await $fetch<any>(`/api/v1/status-pages/${slugRef.value}/maintenances`)
      if (response.ok) maintenanceList.value = response.data || []
    } catch { maintenanceList.value = [] }
  }

  async function unlockStatusPage(password: string) {
    passwordError.value = ''
    try {
      await $fetch(`/api/v1/status-pages/${slugRef.value}/unlock`, {
        method: 'POST',
        body: { password },
      })
      passwordRequired.value = false
      await loadData()
      return true
    } catch (e: any) {
      passwordError.value = e?.data?.message || e?.message || 'Could not unlock status page'
      return false
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
            for (const [key, field] of [['24', 'uptime24'], ['7', 'uptime7'], ['30', 'uptime30']] as const) {
              const value = uptimeList.value[`${monitor.id}_${key}`]
              if (value !== undefined) {
                // A monitor with no observations has no uptime yet — 0.00% would be misleading.
                ;(monitor as any)[field] = value === 0 && !(heartbeatList.value[monitor.id] || []).length ? null : value
              }
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
    // First, load with noPagination just to get groupTabs info
    // Then load with pagination for the first group
    await loadData({ noPagination: false })
    
    await loadMaintenance()

    // Load heartbeat for initial monitors
    const monitorIds = groups.value.flatMap(g => g.monitorList.map(m => m.id))
    if (monitorIds.length) {
      await loadHeartbeat(monitorIds)
    }
    
    // Start auto-refresh
    startAutoRefresh()
  }

  // ==========================================
  // Edit Mode State & Methods
  // ==========================================
  
  const editMode = ref(false)
  const saving = ref(false)
  const unsavedChanges = ref(false)
  
  // Draft state for edit mode
  const draftConfig = ref<Partial<StatusPageConfig>>({})
  const draftIncident = ref<Incident | null>(null)
  const draftGroups = ref<PublicGroup[]>([])

  // Enter edit mode
  function enableEditMode() {
    editMode.value = true
    // Clone current state to draft
    draftConfig.value = config.value ? { 
      ...config.value,
      publicGroupList: groups.value.map(g => ({
        ...g,
        monitorList: [...g.monitorList]
      }))
    } : {}
    draftIncident.value = incident.value ? { ...incident.value } : null
    draftGroups.value = groups.value.map(g => ({
      ...g,
      monitorList: [...g.monitorList]
    }))
  }

  // Exit edit mode without saving
  function disableEditMode() {
    editMode.value = false
    unsavedChanges.value = false
    draftConfig.value = {}
    draftIncident.value = null
    draftGroups.value = []
  }

  // Update draft config
  function updateDraftConfig(updates: Partial<StatusPageConfig>) {
    draftConfig.value = { ...draftConfig.value, ...updates }
    unsavedChanges.value = true
  }

  // Save status page changes
  async function saveStatusPage() {
    try {
      saving.value = true
      
      const bodyData = {
        ...draftConfig.value,
        publicGroupList: draftGroups.value.map((g, index) => ({
          id: g.id,
          name: g.name,
          weight: g.weight ?? index + 1,
          monitorList: g.monitorList.map(m => ({ id: m.id, sendUrl: m.sendUrl === true }))
        }))
      }
      
      console.log('Saving status page with data:', bodyData)
      
      const response = await $fetch<any>(`/api/v1/status-pages/${slugRef.value}`, {
        method: 'PUT',
        body: bodyData
      })

      if (response.ok) {
        // Merge draft into main state
        config.value = { ...config.value, ...draftConfig.value } as StatusPageConfig
        groups.value = draftGroups.value
        unsavedChanges.value = false
        return { success: true }
      } else {
        return { success: false, error: response.message || 'Failed to save' }
      }
    } catch (e: any) {
      console.error('Failed to save status page:', e)
      return { success: false, error: e.data?.message || e.message }
    } finally {
      saving.value = false
    }
  }

  // Delete status page
  async function deleteStatusPage() {
    try {
      saving.value = true
      
      const response = await $fetch<any>(`/api/v1/status-pages/${slugRef.value}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        return { success: true }
      } else {
        return { success: false, error: response.message || 'Failed to delete' }
      }
    } catch (e: any) {
      console.error('Failed to delete status page:', e)
      return { success: false, error: e.data?.message || e.message }
    } finally {
      saving.value = false
    }
  }

  // Post incident
  async function postIncident(incidentData: Incident) {
    try {
      saving.value = true
      
      // Use plural endpoint to match server route
      const response = await $fetch<any>(`/api/v1/status-pages/${slugRef.value}/incidents`, {
        method: 'POST',
        body: {
          ...incidentData,
          pin: true
        }
      })

      if (response.ok && response.data) {
        const mapped = {
          ...response.data,
          createdDate: response.data.createdDate || response.data.createdAt,
          lastUpdatedDate: response.data.lastUpdatedDate || response.data.updatedAt
        }
        incident.value = mapped
        incidents.value = [mapped, ...incidents.value.filter(item => item.id !== mapped.id)].slice(0, 20)
        draftIncident.value = mapped
        return { success: true, incident: mapped }
      } else {
        return { success: false, error: response.message || 'Failed to post incident' }
      }
    } catch (e: any) {
      console.error('Failed to post incident:', e)
      return { success: false, error: e.data?.message || e.message }
    } finally {
      saving.value = false
    }
  }

  // Unpin incident
  async function unpinIncident() {
    try {
      saving.value = true
      
      const response = await $fetch<any>(`/api/v1/status-pages/${slugRef.value}/incident`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const removedId = incident.value?.id
        incident.value = null
        incidents.value = incidents.value.filter(item => item.id !== removedId)
        draftIncident.value = null
        return { success: true }
      } else {
        return { success: false, error: response.message || 'Failed to unpin incident' }
      }
    } catch (e: any) {
      console.error('Failed to unpin incident:', e)
      return { success: false, error: e.data?.message || e.message }
    } finally {
      saving.value = false
    }
  }

  // Add group
  function addGroup() {
    const newGroup: PublicGroup = {
      id: Date.now() * -1, // Temporary negative ID for new groups
      name: 'New Group',
      weight: draftGroups.value.length + 1,
      monitorList: []
    }
    draftGroups.value.push(newGroup)
    unsavedChanges.value = true
  }

  // Remove group
  function removeGroup(groupId: number) {
    draftGroups.value = draftGroups.value.filter(g => g.id !== groupId)
    unsavedChanges.value = true
  }

  // Update group name
  function updateGroupName(groupId: number, name: string) {
    const group = draftGroups.value.find(g => g.id === groupId)
    if (group) {
      group.name = name
      unsavedChanges.value = true
    }
  }

  // Add monitor to group
  function addMonitorToGroup(groupId: number, monitor: PublicMonitor) {
    console.log('addMonitorToGroup called:', { groupId, monitor, draftGroups: draftGroups.value })
    
    // Ensure ID comparison is consistent (both as numbers)
    const groupIndex = draftGroups.value.findIndex(g => Number(g.id) === Number(groupId))
    
    if (groupIndex === -1) {
      console.error('Group not found:', groupId, 'Available groups:', draftGroups.value.map(g => g.id))
      return
    }
    
    const group = draftGroups.value[groupIndex]
    
    if (group.monitorList.some(m => Number(m.id) === Number(monitor.id))) {
      console.log('Monitor already in group:', monitor.id)
      return
    }
    
    // Create a new array to trigger Vue reactivity
    const newMonitorList = [...group.monitorList, monitor]
    const newGroup = { ...group, monitorList: newMonitorList }
    
    // Replace the entire draftGroups array to ensure reactivity
    draftGroups.value = [
      ...draftGroups.value.slice(0, groupIndex),
      newGroup,
      ...draftGroups.value.slice(groupIndex + 1)
    ]
    
    unsavedChanges.value = true
    console.log('Monitor added, updated draftGroups:', draftGroups.value)
  }

  // Remove monitor from group
  function removeMonitorFromGroup(groupId: number, monitorId: number) {
    const group = draftGroups.value.find(g => g.id === groupId)
    if (group) {
      group.monitorList = group.monitorList.filter(m => m.id !== monitorId)
      unsavedChanges.value = true
    }
  }

  // Reorder groups
  function reorderGroups(newOrder: PublicGroup[]) {
    draftGroups.value = newOrder.map((g, i) => ({ ...g, weight: i + 1 }))
    unsavedChanges.value = true
  }

  // Upload logo
  async function uploadLogo(logoDataUrl: string): Promise<{ success: boolean; logoUrl?: string; error?: string }> {
    try {
      saving.value = true
      
      const response = await $fetch<any>(`/api/v1/status-pages/${slugRef.value}/upload-logo`, {
        method: 'POST',
        body: { logo: logoDataUrl }
      })

      if (response.ok && response.data?.logoUrl) {
        draftConfig.value.icon = response.data.logoUrl
        unsavedChanges.value = true
        return { success: true, logoUrl: response.data.logoUrl }
      } else {
        return { success: false, error: response.message || 'Failed to upload logo' }
      }
    } catch (e: any) {
      console.error('Failed to upload logo:', e)
      return { success: false, error: e.data?.message || e.message }
    } finally {
      saving.value = false
    }
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
    incidents,
    maintenanceList,
    heartbeatList,
    uptimeList,
    groupTabs,
    pagination,
    
    // UI State
    loading,
    error,
    passwordRequired,
    passwordError,
    unlockStatusPage,
    activeTab,
    page,
    search,
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
    loadMaintenance,
    loadHeartbeat,
    switchTab,
    changePage,
    startAutoRefresh,
    stopAutoRefresh,
    
    // Edit Mode State
    editMode,
    saving,
    unsavedChanges,
    draftConfig,
    draftIncident,
    draftGroups,
    
    // Edit Mode Methods
    enableEditMode,
    disableEditMode,
    updateDraftConfig,
    saveStatusPage,
    deleteStatusPage,
    postIncident,
    unpinIncident,
    addGroup,
    removeGroup,
    updateGroupName,
    addMonitorToGroup,
    removeMonitorFromGroup,
    reorderGroups,
    uploadLogo
  }
}

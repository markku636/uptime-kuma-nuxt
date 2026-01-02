// Maintenance composable for managing scheduled maintenance
import type { Ref } from 'vue'

interface Monitor {
  id: number
  name: string
}

interface Maintenance {
  id: number
  title: string
  description?: string
  strategy: 'single' | 'recurring' | 'manual'
  active: boolean
  startDate?: string
  endDate?: string
  intervalDay?: number
  weekdays?: string[]
  daysOfMonth?: number[]
  timeRange?: { start: string; end: string }[]
  monitors?: Monitor[]
  createdAt?: string
  updatedAt?: string
}

interface UseMaintenancesOptions {
  autoFetch?: boolean
}

export function useMaintenances(options: UseMaintenancesOptions = {}) {
  const { autoFetch = true } = options

  // State
  const maintenances: Ref<Maintenance[]> = ref([])
  const selectedMaintenance: Ref<Maintenance | null> = ref(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const activeMaintenances = computed(() => 
    maintenances.value.filter(m => isMaintenanceActive(m))
  )

  const scheduledMaintenances = computed(() => 
    maintenances.value.filter(m => !isMaintenanceActive(m) && !isMaintenanceEnded(m))
  )

  const endedMaintenances = computed(() => 
    maintenances.value.filter(m => isMaintenanceEnded(m))
  )

  // Methods
  function isMaintenanceActive(m: Maintenance): boolean {
    if (!m.active) return false
    if (m.strategy === 'manual') return m.active
    
    const now = new Date()
    const start = m.startDate ? new Date(m.startDate) : null
    const end = m.endDate ? new Date(m.endDate) : null
    
    if (!start) return false
    return start <= now && (!end || end >= now)
  }

  function isMaintenanceEnded(m: Maintenance): boolean {
    if (!m.endDate) return false
    return new Date(m.endDate) < new Date()
  }

  async function fetchMaintenances() {
    try {
      isLoading.value = true
      error.value = null
      
      const data = await $fetch<Maintenance[]>('/api/v1/maintenance')
      maintenances.value = data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch maintenances'
      console.error('Failed to fetch maintenances:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchMaintenance(id: number) {
    try {
      isLoading.value = true
      const data = await $fetch<Maintenance>(`/api/v1/maintenance/${id}`)
      
      // Update in list
      const index = maintenances.value.findIndex(m => m.id === id)
      if (index !== -1) {
        maintenances.value[index] = data
      } else {
        maintenances.value.push(data)
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch maintenance'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createMaintenance(maintenanceData: Partial<Maintenance>) {
    try {
      isLoading.value = true
      const data = await $fetch<Maintenance>('/api/v1/maintenance', {
        method: 'POST',
        body: maintenanceData
      })
      
      maintenances.value.push(data)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to create maintenance'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateMaintenance(id: number, maintenanceData: Partial<Maintenance>) {
    try {
      isLoading.value = true
      const data = await $fetch<Maintenance>(`/api/v1/maintenance/${id}`, {
        method: 'PUT',
        body: maintenanceData
      })
      
      // Update in list
      const index = maintenances.value.findIndex(m => m.id === id)
      if (index !== -1) {
        maintenances.value[index] = data
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to update maintenance'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteMaintenance(id: number) {
    try {
      isLoading.value = true
      await $fetch(`/api/v1/maintenance/${id}`, {
        method: 'DELETE'
      })
      
      // Remove from list
      maintenances.value = maintenances.value.filter(m => m.id !== id)
      
      if (selectedMaintenance.value?.id === id) {
        selectedMaintenance.value = null
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete maintenance'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function pauseMaintenance(id: number) {
    return updateMaintenance(id, { active: false })
  }

  async function resumeMaintenance(id: number) {
    return updateMaintenance(id, { active: true })
  }

  function getAffectedMonitors(maintenanceId: number): Monitor[] {
    const maintenance = maintenances.value.find(m => m.id === maintenanceId)
    return maintenance?.monitors || []
  }

  // Auto fetch on mount
  if (autoFetch) {
    onMounted(() => {
      fetchMaintenances()
    })
  }

  return {
    // State
    maintenances,
    selectedMaintenance,
    isLoading,
    error,

    // Computed
    activeMaintenances,
    scheduledMaintenances,
    endedMaintenances,

    // Methods
    fetchMaintenances,
    fetchMaintenance,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
    pauseMaintenance,
    resumeMaintenance,
    isMaintenanceActive,
    isMaintenanceEnded,
    getAffectedMonitors,
  }
}

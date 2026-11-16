// Maintenance windows: REST access + live updates over Socket.IO.
// Status and timeslots are computed by the server (services/maintenance/schedule.ts).

export type MaintenanceStrategy =
  | 'manual'
  | 'single'
  | 'cron'
  | 'recurring-interval'
  | 'recurring-weekday'
  | 'recurring-day-of-month'

export type MaintenanceStatus = 'inactive' | 'scheduled' | 'under-maintenance' | 'ended' | 'unknown'

export interface TimeOfDay {
  hours: number
  minutes: number
}

export interface Maintenance {
  id: number
  title: string
  description: string
  strategy: MaintenanceStrategy
  active: boolean
  intervalDay: number
  /** Wall-clock "YYYY-MM-DD HH:mm" strings in the maintenance timezone */
  dateRange: (string | null)[]
  timeRange: [TimeOfDay, TimeOfDay]
  weekdays: number[]
  daysOfMonth: (number | string)[]
  timeslotList: { startDate: string; endDate: string }[]
  cron: string
  duration: number
  durationMinutes: number
  timezone: string
  timezoneOption: string
  timezoneOffset: string
  status: MaintenanceStatus
  monitors?: number[]
  statusPages?: number[]
}

export interface MaintenanceInput {
  title: string
  description: string
  strategy: MaintenanceStrategy
  intervalDay: number
  dateRange: (string | null)[]
  timeRange: [TimeOfDay, TimeOfDay]
  weekdays: number[]
  daysOfMonth: (number | string)[]
  cron: string
  durationMinutes: number
  timezoneOption: string
  monitors: number[]
  statusPages: number[]
}

/** Display order on the list page, same as upstream ManageMaintenance.vue */
export const MAINTENANCE_STATUS_ORDER: Record<MaintenanceStatus, number> = {
  'under-maintenance': 0,
  scheduled: 1,
  inactive: 2,
  ended: 3,
  unknown: 4,
}

/** Semantic colour (tokens) per status */
export const MAINTENANCE_STATUS_TONE: Record<MaintenanceStatus, 'maintenance' | 'pending' | 'unknown' | 'up'> = {
  'under-maintenance': 'maintenance',
  scheduled: 'pending',
  inactive: 'unknown',
  ended: 'unknown',
  unknown: 'unknown',
}

export function sortMaintenances(list: Maintenance[]): Maintenance[] {
  return [...list].sort((a, b) => {
    const diff = MAINTENANCE_STATUS_ORDER[a.status] - MAINTENANCE_STATUS_ORDER[b.status]
    if (diff !== 0) return diff
    return a.title.localeCompare(b.title)
  })
}

export function errorMessage(e: any, fallback: string): string {
  return e?.data?.message || e?.statusMessage || e?.message || fallback
}

const API = '/api/v1/maintenances'

export function useMaintenances(options: { autoFetch?: boolean; live?: boolean } = {}) {
  const { autoFetch = true, live = true } = options

  const maintenances = useState<Maintenance[]>('maintenance-list', () => [])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const sortedMaintenances = computed(() => sortMaintenances(maintenances.value))
  const activeCount = computed(() => maintenances.value.filter(m => m.status === 'under-maintenance').length)

  function upsert(item: Maintenance) {
    const index = maintenances.value.findIndex(m => m.id === item.id)
    if (index >= 0) maintenances.value.splice(index, 1, item)
    else maintenances.value.unshift(item)
  }

  async function fetchMaintenances() {
    isLoading.value = true
    error.value = null
    try {
      const res = await $fetch<{ data: Maintenance[] }>(API)
      maintenances.value = res.data
    } catch (e) {
      error.value = errorMessage(e, 'Failed to load maintenances')
    } finally {
      isLoading.value = false
    }
  }

  async function getMaintenance(id: number) {
    const res = await $fetch<{ data: Maintenance }>(`${API}/${id}`)
    return res.data
  }

  async function createMaintenance(input: MaintenanceInput) {
    const res = await $fetch<{ data: Maintenance }>(API, { method: 'POST', body: input })
    upsert(res.data)
    return res.data
  }

  async function updateMaintenance(id: number, input: MaintenanceInput) {
    const res = await $fetch<{ data: Maintenance }>(`${API}/${id}`, { method: 'PUT', body: input })
    upsert(res.data)
    return res.data
  }

  async function setActive(id: number, active: boolean) {
    const res = await $fetch<{ data: Maintenance }>(`${API}/${id}/${active ? 'resume' : 'pause'}`, { method: 'POST' })
    upsert(res.data)
    return res.data
  }

  async function deleteMaintenance(id: number) {
    await $fetch(`${API}/${id}`, { method: 'DELETE' })
    maintenances.value = maintenances.value.filter(m => m.id !== id)
  }

  // Live updates when an authenticated socket is already open (server pushes
  // maintenanceList when a window opens/closes). Status is also refreshed
  // periodically so the list stays correct without a socket.
  if (import.meta.client && live) {
    const { $socket } = useNuxtApp() as any
    const socket = $socket?.getSocket?.()
    const onList = (list: Maintenance[]) => { maintenances.value = list }
    const onUpsert = (item: Maintenance) => upsert(item)
    const onDelete = (id: number) => { maintenances.value = maintenances.value.filter(m => m.id !== id) }
    if (socket) {
      socket.on('maintenanceList', onList)
      socket.on('maintenanceAdded', onUpsert)
      socket.on('maintenanceUpdated', onUpsert)
      socket.on('maintenanceDeleted', onDelete)
    }
    const timer = setInterval(() => { if (!document.hidden) fetchMaintenances() }, 60_000)
    onScopeDispose(() => {
      clearInterval(timer)
      socket?.off('maintenanceList', onList)
      socket?.off('maintenanceAdded', onUpsert)
      socket?.off('maintenanceUpdated', onUpsert)
      socket?.off('maintenanceDeleted', onDelete)
    })
  }

  if (autoFetch) {
    onMounted(fetchMaintenances)
  }

  return {
    maintenances,
    sortedMaintenances,
    activeCount,
    isLoading,
    error,
    fetchMaintenances,
    getMaintenance,
    createMaintenance,
    updateMaintenance,
    setActive,
    deleteMaintenance,
  }
}

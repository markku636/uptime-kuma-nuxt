// Workspaces and monitor groups (Workspace -> Group -> Monitor).
// A group is a monitor with type "group"; members reference it via `parent`.
// The selected workspace is remembered in a cookie so the dashboard, the
// monitor list and the forms all agree, also after a reload.

export interface Workspace {
  id: number
  name: string
  description: string | null
  color: string
  weight: number
  monitorCount: number
  groupCount: number
}

export interface MonitorGroup {
  id: number
  name: string
  description: string | null
  active: boolean
  parent: number | null
  workspaceId: number | null
  weight: number
  monitorCount: number
}

/** 'all': no filter, 'none': monitors without a workspace, number: that workspace */
export type WorkspaceFilter = number | 'all' | 'none'

export interface WorkspaceInput {
  name: string
  description?: string | null
  color?: string
}

export interface GroupInput {
  name: string
  description?: string | null
  workspaceId?: number | null
}

export const WORKSPACE_COLORS = ['#5cdd8b', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316', '#ec4899', '#14b8a6', '#6b7280']

export function workspaceErrorMessage(e: any, fallback: string): string {
  return e?.data?.message || e?.statusMessage || e?.message || fallback
}

/** Does a monitor (or group) belong to the selected workspace? */
export function matchesWorkspace(item: { workspaceId?: number | null }, filter: WorkspaceFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return item.workspaceId == null
  return item.workspaceId === filter
}

// Client only (fetching starts in onMounted), so module state is not shared between requests
let inflight: Promise<void> | null = null

export function useWorkspaces(options: { autoFetch?: boolean } = {}) {
  const { autoFetch = true } = options

  const workspaces = useState<Workspace[]>('workspace-list', () => [])
  const groups = useState<MonitorGroup[]>('workspace-groups', () => [])
  const unassigned = useState('workspace-unassigned', () => ({ monitorCount: 0, groupCount: 0 }))
  const loaded = useState('workspace-loaded', () => false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const current = useCookie<WorkspaceFilter>('uk-workspace', {
    default: () => 'all',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const currentWorkspace = computed(() =>
    typeof current.value === 'number' ? workspaces.value.find(w => w.id === current.value) ?? null : null,
  )

  /** Workspace to pre-select when something new is created from the current view */
  const defaultWorkspaceId = computed(() => currentWorkspace.value?.id ?? null)

  // Several components on one page use this composable: share a single request
  function fetchAll() {
    inflight ??= load().finally(() => { inflight = null })
    return inflight
  }

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      const [workspaceRes, groupRes] = await Promise.all([
        $fetch<{ data: { workspaces: Workspace[]; unassigned: { monitorCount: number; groupCount: number } } }>('/api/v1/workspaces'),
        $fetch<{ data: MonitorGroup[] }>('/api/v1/groups'),
      ])
      workspaces.value = workspaceRes.data.workspaces
      unassigned.value = workspaceRes.data.unassigned
      groups.value = groupRes.data
      loaded.value = true

      // The remembered workspace may have been deleted (here or in another tab)
      if (typeof current.value === 'number' && !workspaces.value.some(w => w.id === current.value)) {
        current.value = 'all'
      }
    } catch (e) {
      error.value = workspaceErrorMessage(e, 'Failed to load workspaces')
    } finally {
      isLoading.value = false
    }
  }

  async function createWorkspace(input: WorkspaceInput) {
    const res = await $fetch<{ data: Workspace }>('/api/v1/workspaces', { method: 'POST', body: input })
    workspaces.value = [...workspaces.value, res.data]
    return res.data
  }

  async function updateWorkspace(id: number, input: WorkspaceInput) {
    const res = await $fetch<{ data: Workspace }>(`/api/v1/workspaces/${id}`, { method: 'PUT', body: input })
    workspaces.value = workspaces.value.map(w => (w.id === id ? { ...w, ...res.data } : w))
    return res.data
  }

  async function deleteWorkspace(id: number) {
    await $fetch(`/api/v1/workspaces/${id}`, { method: 'DELETE' })
    if (current.value === id) current.value = 'all'
    await fetchAll()
  }

  async function createGroup(input: GroupInput) {
    const res = await $fetch<{ data: MonitorGroup }>('/api/v1/groups', { method: 'POST', body: input })
    await fetchAll()
    return res.data
  }

  async function updateGroup(id: number, input: GroupInput) {
    const res = await $fetch<{ data: MonitorGroup }>(`/api/v1/groups/${id}`, { method: 'PUT', body: input })
    await fetchAll()
    return res.data
  }

  async function deleteGroup(id: number) {
    await $fetch(`/api/v1/groups/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  /**
   * Move monitors into a group and / or a workspace.
   * parent: number = into that group, null = out of its group, undefined = keep.
   */
  async function organize(monitorIds: number[], target: { parent?: number | null; workspaceId?: number | null }) {
    await $fetch('/api/v1/monitors/organize', { method: 'POST', body: { monitorIds, ...target } })
    await fetchAll()
  }

  // Refresh on every mount so counts follow changes made on other pages
  if (autoFetch) {
    onMounted(fetchAll)
  }

  return {
    workspaces,
    groups,
    unassigned,
    loaded,
    isLoading,
    error,
    current,
    currentWorkspace,
    defaultWorkspaceId,
    fetchAll,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    createGroup,
    updateGroup,
    deleteGroup,
    organize,
  }
}

export interface WorkspaceOption { id: number; name: string; role: 'owner'|'editor'|'viewer'; environments: { id: number; name: string }[] }
export function useWorkspace() {
  const workspaces = useState<WorkspaceOption[]>('workspaces', () => [])
  const workspaceCookie = useCookie<string | null>('workspace_id', { sameSite: 'lax', maxAge: 31536000 })
  const environmentCookie = useCookie<string | null>('environment_id', { sameSite: 'lax', maxAge: 31536000 })
  const current = computed(() => workspaces.value.find(w => w.id === Number(workspaceCookie.value)) || workspaces.value[0])
  const environment = computed(() => current.value?.environments.find(e => e.id === Number(environmentCookie.value)) || current.value?.environments[0])
  const canEdit = computed(() => !!current.value && current.value.role !== 'viewer')
  const canManage = computed(() => current.value?.role === 'owner')
  async function load() {
    const response = await $fetch<{ ok: boolean; data: WorkspaceOption[] }>('/api/v1/workspaces')
    workspaces.value = response.data
    if (current.value) workspaceCookie.value = String(current.value.id)
    if (environment.value) environmentCookie.value = String(environment.value.id)
  }
  function change(workspaceId: number, environmentId?: number) {
    const workspace = workspaces.value.find(w => w.id === workspaceId)
    if (!workspace) return
    workspaceCookie.value = String(workspaceId)
    environmentCookie.value = String(environmentId || workspace.environments[0]?.id || '')
    if (import.meta.client) {
      useNuxtApp().$socket?.disconnect()
      window.location.assign('/dashboard')
    }
  }
  return { workspaces, current, environment, canEdit, canManage, load, change }
}

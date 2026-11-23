interface EnvironmentInfo {
  id: number
  workspaceId: number
  name: string
  variables: Record<string, string>
  secretNames: string[]
}

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

export function previewEnvironmentVariables(text: string, variables: Record<string, string>, secretNames: string[]) {
  const secrets = new Set(secretNames)
  const missing: string[] = []
  const preview = text.replace(PLACEHOLDER, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return secrets.has(name) ? '••••••' : variables[name]
    }
    missing.push(name)
    return match
  })
  return { preview, missing: [...new Set(missing)] }
}

/** Live preview of {{variables}} for the currently selected workspace environment. */
export function useEnvironmentVariablePreview(text: Ref<string | null | undefined>) {
  const { current, environment } = useWorkspace()
  const info = ref<EnvironmentInfo | null>(null)
  let loading = false

  async function load() {
    if (!current.value?.id || loading) return
    loading = true
    try {
      const response = await $fetch<{ data: EnvironmentInfo[] }>(`/api/v1/workspaces/${current.value.id}/environments`)
      info.value = response?.data?.find(item => item.id === environment.value?.id) || response?.data?.[0] || null
    } catch {
      info.value = null
    } finally {
      loading = false
    }
  }

  watch([text, () => environment.value?.id], ([value]) => {
    if (!value?.includes('{{') || info.value) return
    void load()
  }, { immediate: true })

  return computed(() => {
    const value = text.value
    if (!value?.includes('{{') || !info.value) return null
    return previewEnvironmentVariables(value, info.value.variables || {}, info.value.secretNames || [])
  })
}

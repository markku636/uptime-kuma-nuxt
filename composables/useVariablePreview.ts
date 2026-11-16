// What a text with {{variables}} turns into at check time, for display:
// workspace variables over global ones, secret values as dots (they never
// reach the browser), unknown names kept and listed.

interface VariableRow {
  name: string
  value: string
  secret: boolean
  workspaceId: number | null
}

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

export function previewVariables(text: string, variables: VariableRow[], workspaceId: number | null) {
  const pick = (name: string) =>
    (workspaceId != null ? variables.find(v => v.name === name && v.workspaceId === workspaceId) : undefined)
    ?? variables.find(v => v.name === name && v.workspaceId == null)
  const missing: string[] = []
  const filled = text.replace(PLACEHOLDER, (match, name: string) => {
    const v = pick(name)
    if (!v) {
      missing.push(name)
      return match
    }
    return v.secret ? '••••••' : v.value
  })
  return { text: filled, missing: [...new Set(missing)] }
}

export function useVariablePreview(text: Ref<string | null | undefined>, workspaceId: Ref<number | null | undefined>) {
  // Shared by every form / page that previews, loaded on first need
  const variables = useState<VariableRow[] | null>('variable-preview-list', () => null)

  watch(text, async (value) => {
    if (!value?.includes('{{') || variables.value) return
    try {
      variables.value = (await $fetch<{ data: VariableRow[] }>('/api/v1/variables')).data
    } catch {
      variables.value = []
    }
  }, { immediate: true })

  return computed(() => {
    const value = text.value
    if (!value?.includes('{{') || !variables.value) return null
    return previewVariables(value, variables.value, workspaceId.value ?? null)
  })
}

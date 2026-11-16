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
  // Loaded per form / page on first need, so a page opened after editing
  // variables shows the current values; a failed load is retried on the
  // next change instead of being cached as "no variables"
  const variables = ref<VariableRow[] | null>(null)
  let loading = false

  watch(text, async (value) => {
    if (!value?.includes('{{') || variables.value || loading) return
    loading = true
    try {
      variables.value = (await $fetch<{ data: VariableRow[] }>('/api/v1/variables')).data
    } catch {
      // keep null: no preview rather than a wrong "unknown variable" warning
    } finally {
      loading = false
    }
  }, { immediate: true })

  return computed(() => {
    const value = text.value
    if (!value?.includes('{{') || !variables.value) return null
    return previewVariables(value, variables.value, workspaceId.value ?? null)
  })
}

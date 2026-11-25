import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { previewEnvironmentVariables } from '../utils/variable-preview'

/** Safe DTO: secret VALUES are never returned by the API, only their names. */
export interface WorkspaceEnvironment {
  id: number
  name: string
  variables: Record<string, string>
  secretNames: string[]
}

export interface EnvironmentSavePayload {
  variables?: Record<string, string>
  secrets?: Record<string, string | null>
}

export interface ValidateVariableMapOptions {
  /** Raw JSON mode historically only checks the shape, not the key syntax (the server checks it). */
  checkNames?: boolean
  maxKeys?: number
}

export const MAX_VARIABLE_KEYS = 200
const VARIABLE_NAME = /^[A-Za-z_][\w.-]{0,99}$/

/** Same rule as the existing Settings → Workspaces key/value editor. */
export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME.test(name)
}

/** Pure validation/normalisation for a plain JSON object of string variables. */
export function validateVariableMap(value: unknown, options: ValidateVariableMapOptions = {}): Record<string, string> {
  const { checkNames = true, maxKeys = MAX_VARIABLE_KEYS } = options
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Variables must be a JSON object of strings')
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > maxKeys) throw new Error(`At most ${maxKeys} variables are allowed`)
  const result: Record<string, string> = Object.create(null)
  for (const [name, raw] of entries) {
    if (checkNames && !isValidVariableName(name)) throw new Error(`Invalid variable name: ${name}`)
    if (typeof raw !== 'string') throw new Error('Variables must be a JSON object of strings')
    result[name] = raw
  }
  return result
}

/**
 * Shared workspace-environment state. Secret values only ever travel through
 * saveEnvironment()'s request body; they are never stored in a ref or cached.
 */
export function useEnvironmentVariables() {
  const environments = ref<WorkspaceEnvironment[]>([])
  const loading = ref(false)
  const error = ref('')
  let loadSequence = 0

  async function load(workspaceId: number | string | null | undefined): Promise<WorkspaceEnvironment[]> {
    const id = Number(workspaceId)
    if (!id || !Number.isFinite(id)) return environments.value
    const sequence = ++loadSequence
    loading.value = true
    error.value = ''
    try {
      const response = await $fetch<{ ok: boolean; data: WorkspaceEnvironment[] }>(`/api/v1/workspaces/${id}/environments`)
      if (sequence !== loadSequence) return environments.value
      environments.value = Array.isArray(response?.data) ? response.data : []
      return environments.value
    } catch (e: any) {
      if (sequence !== loadSequence) return environments.value
      error.value = e?.data?.message || e?.message || 'Unable to load environment variables'
      throw e
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  /** Reactive lookup of one environment by a ref/getter of its id. */
  function selected(environmentId: MaybeRefOrGetter<number | string | null | undefined>) {
    return computed(() => environments.value.find(item => item.id === Number(toValue(environmentId))))
  }

  async function saveEnvironment(
    workspaceId: number | string,
    environmentId: number | string,
    payload: EnvironmentSavePayload,
    options: { skipNameValidation?: boolean } = {},
  ) {
    const workspace = Number(workspaceId), environment = Number(environmentId)
    if (!workspace || !environment) throw new Error('Select an environment before saving')
    const body: { variables?: Record<string, string>; secrets?: Record<string, string | null> } = {}
    if (payload.variables !== undefined) {
      body.variables = validateVariableMap(payload.variables, { checkNames: !options.skipNameValidation })
    }
    if (payload.secrets !== undefined) {
      const secrets: Record<string, string | null> = Object.create(null)
      for (const [name, value] of Object.entries(payload.secrets)) {
        if (!options.skipNameValidation && !isValidVariableName(name)) throw new Error(`Invalid variable name: ${name}`)
        if (value !== null && typeof value !== 'string') throw new Error('Secret values must be strings or null')
        secrets[name] = value
      }
      if (Object.keys(secrets).length > MAX_VARIABLE_KEYS) throw new Error(`At most ${MAX_VARIABLE_KEYS} secrets are allowed`)
      body.secrets = secrets
    }
    error.value = ''
    try {
      const response = await $fetch<{ ok: boolean; data: WorkspaceEnvironment }>(
        `/api/v1/workspaces/${workspace}/environments/${environment}`,
        { method: 'PUT', body },
      )
      // Only merge safe fields from the response; never keep a secret value.
      const updated = response?.data
      if (updated?.id) {
        const index = environments.value.findIndex(item => item.id === updated.id)
        if (index !== -1) {
          const next = environments.value.slice()
          next[index] = {
            id: updated.id,
            name: updated.name ?? next[index].name,
            variables: updated.variables ?? {},
            secretNames: Array.isArray(updated.secretNames) ? updated.secretNames : next[index].secretNames,
          }
          environments.value = next
        }
      }
      return response
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || 'Unable to save environment variables'
      throw e
    }
  }

  /** Masked, browser-safe rendering of {{variables}} for one environment. */
  function preview(text: string | null | undefined, environment: WorkspaceEnvironment | null | undefined) {
    if (!text) return { preview: '', missing: [] as string[] }
    return previewEnvironmentVariables(text, environment?.variables || {}, environment?.secretNames || [])
  }

  function reset() {
    ++loadSequence
    environments.value = []
    loading.value = false
    error.value = ''
  }

  return { environments, loading, error, load, selected, saveEnvironment, preview, reset }
}

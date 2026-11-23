type RuntimeRole = 'api' | 'worker' | 'all'

interface RuntimeInstance {
  instanceId: string
  role: RuntimeRole
  state: 'running' | 'draining' | 'offline'
  host: string | null
  node: string | null
}

interface RuntimeData {
  instances: RuntimeInstance[]
  summary: { api: number; workers: number; slots: number; inflight: number }
}

export interface RuntimeHintData {
  api: string[]
  worker: string[]
  slots: number
  inflight: number
  available: boolean
}

const CACHE_MS = 10_000
let cached: { at: number; value: RuntimeHintData } | null = null
let pending: Promise<RuntimeHintData> | null = null

function podName(row: RuntimeInstance): string {
  return row.host || row.instanceId.slice(0, 8)
}

/**
 * Lazy runtime lookup for the ⓘ hints. The endpoint needs platform admin, so a
 * failure is returned as `available: false` instead of throwing — the hint then
 * shows the generic explanation without pod names.
 */
export function useRuntimeHint() {
  async function load(): Promise<RuntimeHintData> {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
    if (pending) return pending

    pending = (async () => {
      try {
        const response = await $fetch<{ data: RuntimeData }>('/api/v1/nodes/runtime')
        const running = (response.data?.instances ?? []).filter((row) => row.state === 'running')
        const api = running.filter((row) => row.role === 'api' || row.role === 'all').map(podName)
        const worker = running.filter((row) => row.role === 'worker' || row.role === 'all').map(podName)
        const value: RuntimeHintData = {
          api: [...new Set(api)],
          worker: [...new Set(worker)],
          slots: response.data?.summary?.slots ?? 0,
          inflight: response.data?.summary?.inflight ?? 0,
          available: true,
        }
        cached = { at: Date.now(), value }
        return value
      } catch {
        return { api: [], worker: [], slots: 0, inflight: 0, available: false }
      } finally {
        pending = null
      }
    })()

    return pending
  }

  return { load }
}

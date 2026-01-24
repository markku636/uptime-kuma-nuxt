// Proxies composable for managing HTTP proxies
import type { Ref } from 'vue'

interface Proxy {
  id: number
  userId: number
  protocol: string
  host: string
  port: number
  auth: boolean
  username?: string
  password?: string
  active: boolean
  isDefault: boolean
  createdAt?: string
}

interface UseProxiesOptions {
  autoFetch?: boolean
}

export function useProxies(options: UseProxiesOptions = {}) {
  const { autoFetch = true } = options

  // State
  const proxies: Ref<Proxy[]> = ref([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const activeProxies = computed(() => 
    proxies.value.filter(p => p.active)
  )

  const defaultProxy = computed(() => 
    proxies.value.find(p => p.isDefault)
  )

  // Methods
  async function fetchProxies() {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await $fetch<{ ok: boolean; data: Proxy[] }>('/api/v1/proxies')
      proxies.value = response.data || []
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch proxies'
      console.error('Failed to fetch proxies:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function createProxy(proxyData: Partial<Proxy>) {
    try {
      isLoading.value = true
      const data = await $fetch<Proxy>('/api/v1/proxies', {
        method: 'POST',
        body: proxyData
      })
      
      proxies.value.push(data)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to create proxy'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateProxy(id: number, proxyData: Partial<Proxy>) {
    try {
      isLoading.value = true
      const data = await $fetch<Proxy>(`/api/v1/proxies/${id}`, {
        method: 'PUT',
        body: proxyData
      })
      
      const index = proxies.value.findIndex(p => p.id === id)
      if (index !== -1) {
        proxies.value[index] = data
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to update proxy'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteProxy(id: number) {
    try {
      isLoading.value = true
      await $fetch(`/api/v1/proxies/${id}`, {
        method: 'DELETE'
      })
      
      proxies.value = proxies.value.filter(p => p.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete proxy'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function getProxy(id: number) {
    return proxies.value.find(p => p.id === id)
  }

  // Auto-fetch on mount if enabled
  if (autoFetch && import.meta.client) {
    onMounted(() => {
      fetchProxies()
    })
  }

  return {
    // State
    proxies,
    isLoading,
    error,
    // Computed
    activeProxies,
    defaultProxy,
    // Methods
    fetchProxies,
    createProxy,
    updateProxy,
    deleteProxy,
    getProxy
  }
}

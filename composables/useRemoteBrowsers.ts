// Remote Browsers composable for managing Chromium-based remote browsers
import type { Ref } from 'vue'

interface RemoteBrowser {
  id: number
  userId: number
  name: string
  url?: string
  configured?: Record<string,boolean>
  createdAt?: string
}

interface UseRemoteBrowsersOptions {
  autoFetch?: boolean
}

export function useRemoteBrowsers(options: UseRemoteBrowsersOptions = {}) {
  const { autoFetch = true } = options

  // State
  const remoteBrowsers: Ref<RemoteBrowser[]> = ref([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Methods
  async function fetchRemoteBrowsers() {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await $fetch<{ ok: boolean; data: RemoteBrowser[] }>('/api/v1/remote-browsers')
      remoteBrowsers.value = response.data || []
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch remote browsers'
      console.error('Failed to fetch remote browsers:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function createRemoteBrowser(browserData: Partial<RemoteBrowser>) {
    try {
      isLoading.value = true
      const response = await $fetch<{data:RemoteBrowser}>('/api/v1/remote-browsers', {
        method: 'POST',
        body: browserData
      })
      
      const data=response.data
      remoteBrowsers.value.push(data)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to create remote browser'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateRemoteBrowser(id: number, browserData: Partial<RemoteBrowser>) {
    try {
      isLoading.value = true
      const response = await $fetch<{data:RemoteBrowser}>(`/api/v1/remote-browsers/${id}`, {
        method: 'PUT',
        body: browserData
      })
      
      const data=response.data
      const index = remoteBrowsers.value.findIndex(b => b.id === id)
      if (index !== -1) {
        remoteBrowsers.value[index] = data
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to update remote browser'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteRemoteBrowser(id: number) {
    try {
      isLoading.value = true
      await $fetch(`/api/v1/remote-browsers/${id}`, {
        method: 'DELETE'
      })
      
      remoteBrowsers.value = remoteBrowsers.value.filter(b => b.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete remote browser'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function getRemoteBrowser(id: number) {
    return remoteBrowsers.value.find(b => b.id === id)
  }

  // Auto-fetch on mount if enabled
  if (autoFetch && import.meta.client) {
    onMounted(() => {
      fetchRemoteBrowsers()
    })
  }

  return {
    // State
    remoteBrowsers,
    isLoading,
    error,
    // Methods
    fetchRemoteBrowsers,
    createRemoteBrowser,
    updateRemoteBrowser,
    deleteRemoteBrowser,
    getRemoteBrowser
  }
}

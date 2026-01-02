// Status pages composable
import type { Ref } from 'vue'

interface StatusPageMonitor {
  id: number
  name: string
  status?: number
  uptime?: number
}

interface StatusPageGroup {
  id: number
  name: string
  monitors: StatusPageMonitor[]
}

interface StatusPage {
  id: number
  slug: string
  title: string
  description?: string
  theme: 'auto' | 'light' | 'dark'
  published: boolean
  showTags: boolean
  domainNameList?: string[]
  customCSS?: string
  footerText?: string
  showPoweredBy: boolean
  icon?: string
  groups?: StatusPageGroup[]
  monitors?: StatusPageMonitor[]
  createdAt?: string
  updatedAt?: string
}

interface UseStatusPagesOptions {
  autoFetch?: boolean
}

export function useStatusPages(options: UseStatusPagesOptions = {}) {
  const { autoFetch = true } = options

  // State
  const statusPages: Ref<StatusPage[]> = ref([])
  const selectedStatusPage: Ref<StatusPage | null> = ref(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const publishedStatusPages = computed(() => 
    statusPages.value.filter(sp => sp.published)
  )

  const draftStatusPages = computed(() => 
    statusPages.value.filter(sp => !sp.published)
  )

  // Methods
  async function fetchStatusPages() {
    try {
      isLoading.value = true
      error.value = null
      
      const data = await $fetch<StatusPage[]>('/api/v1/status-pages')
      statusPages.value = data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch status pages'
      console.error('Failed to fetch status pages:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchStatusPage(idOrSlug: number | string) {
    try {
      isLoading.value = true
      const endpoint = typeof idOrSlug === 'number'
        ? `/api/v1/status-pages/${idOrSlug}`
        : `/api/v1/status-page/${idOrSlug}`
      
      const data = await $fetch<StatusPage>(endpoint)
      
      // Update in list
      const index = statusPages.value.findIndex(sp => sp.id === data.id)
      if (index !== -1) {
        statusPages.value[index] = data
      } else {
        statusPages.value.push(data)
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch status page'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchPublicStatusPage(slug: string) {
    try {
      isLoading.value = true
      
      const data = await $fetch<StatusPage>(`/api/v1/status-page/${slug}/heartbeat`)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch status page'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createStatusPage(statusPageData: Partial<StatusPage>) {
    try {
      isLoading.value = true
      const data = await $fetch<StatusPage>('/api/v1/status-pages', {
        method: 'POST',
        body: statusPageData
      })
      
      statusPages.value.push(data)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to create status page'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateStatusPage(id: number, statusPageData: Partial<StatusPage>) {
    try {
      isLoading.value = true
      const data = await $fetch<StatusPage>(`/api/v1/status-pages/${id}`, {
        method: 'PUT',
        body: statusPageData
      })
      
      // Update in list
      const index = statusPages.value.findIndex(sp => sp.id === id)
      if (index !== -1) {
        statusPages.value[index] = data
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to update status page'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteStatusPage(id: number) {
    try {
      isLoading.value = true
      await $fetch(`/api/v1/status-pages/${id}`, {
        method: 'DELETE'
      })
      
      // Remove from list
      statusPages.value = statusPages.value.filter(sp => sp.id !== id)
      
      if (selectedStatusPage.value?.id === id) {
        selectedStatusPage.value = null
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete status page'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function togglePublished(id: number) {
    const statusPage = statusPages.value.find(sp => sp.id === id)
    if (!statusPage) return
    
    return updateStatusPage(id, { published: !statusPage.published })
  }

  function getStatusPageUrl(slug: string, customDomain?: string): string {
    if (customDomain) {
      return `https://${customDomain}`
    }
    return `/status/${slug}`
  }

  // Auto fetch on mount
  if (autoFetch) {
    onMounted(() => {
      fetchStatusPages()
    })
  }

  return {
    // State
    statusPages,
    selectedStatusPage,
    isLoading,
    error,

    // Computed
    publishedStatusPages,
    draftStatusPages,

    // Methods
    fetchStatusPages,
    fetchStatusPage,
    fetchPublicStatusPage,
    createStatusPage,
    updateStatusPage,
    deleteStatusPage,
    togglePublished,
    getStatusPageUrl,
  }
}

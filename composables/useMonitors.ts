// composables/useMonitors.ts

export const useMonitors = () => {
  const monitors = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchMonitors = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await $fetch<{ ok: boolean; data: any[] }>('/api/v1/monitors')
      if (response.ok) {
        monitors.value = response.data
      }
    } catch (e: any) {
      error.value = e.data?.message || 'Failed to fetch monitors'
    } finally {
      loading.value = false
    }
  }

  const getMonitor = async (id: number) => {
    try {
      const response = await $fetch<{ ok: boolean; data: any }>(`/api/v1/monitors/${id}`)
      return response.data
    } catch (e: any) {
      throw new Error(e.data?.message || 'Failed to fetch monitor')
    }
  }

  const createMonitor = async (data: any) => {
    try {
      const response = await $fetch<{ ok: boolean; data: any }>('/api/v1/monitors', {
        method: 'POST',
        body: data,
      })
      if (response.ok) {
        monitors.value.push(response.data)
        return response.data
      }
    } catch (e: any) {
      throw new Error(e.data?.message || 'Failed to create monitor')
    }
  }

  const updateMonitor = async (id: number, data: any) => {
    try {
      const response = await $fetch<{ ok: boolean; data: any }>(`/api/v1/monitors/${id}`, {
        method: 'PUT',
        body: data,
      })
      if (response.ok) {
        const index = monitors.value.findIndex(m => m.id === id)
        if (index !== -1) {
          monitors.value[index] = response.data
        }
        return response.data
      }
    } catch (e: any) {
      throw new Error(e.data?.message || 'Failed to update monitor')
    }
  }

  const deleteMonitor = async (id: number) => {
    try {
      await $fetch(`/api/v1/monitors/${id}`, {
        method: 'DELETE',
      })
      monitors.value = monitors.value.filter(m => m.id !== id)
    } catch (e: any) {
      throw new Error(e.data?.message || 'Failed to delete monitor')
    }
  }

  const pauseMonitor = async (id: number) => {
    try {
      const response = await $fetch<{ ok: boolean; data: any }>(`/api/v1/monitors/${id}/pause`, {
        method: 'POST',
      })
      if (response.ok) {
        const index = monitors.value.findIndex(m => m.id === id)
        if (index !== -1) {
          monitors.value[index].active = false
        }
      }
    } catch (e: any) {
      throw new Error(e.data?.message || 'Failed to pause monitor')
    }
  }

  const resumeMonitor = async (id: number) => {
    try {
      const response = await $fetch<{ ok: boolean; data: any }>(`/api/v1/monitors/${id}/resume`, {
        method: 'POST',
      })
      if (response.ok) {
        const index = monitors.value.findIndex(m => m.id === id)
        if (index !== -1) {
          monitors.value[index].active = true
        }
      }
    } catch (e: any) {
      throw new Error(e.data?.message || 'Failed to resume monitor')
    }
  }

  return {
    monitors: readonly(monitors),
    loading: readonly(loading),
    error: readonly(error),
    fetchMonitors,
    getMonitor,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    pauseMonitor,
    resumeMonitor,
  }
}

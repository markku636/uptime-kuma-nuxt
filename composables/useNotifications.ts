// Notifications composable for managing notification providers
import type { Ref } from 'vue'

interface Notification {
  id: number
  name: string
  type: string
  active: boolean
  isDefault: boolean
  userId?: number
  config: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

interface UseNotificationsOptions {
  autoFetch?: boolean
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { autoFetch = true } = options

  // State
  const notifications: Ref<Notification[]> = ref([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const activeNotifications = computed(() => 
    notifications.value.filter(n => n.active)
  )

  const defaultNotifications = computed(() => 
    notifications.value.filter(n => n.isDefault)
  )

  const notificationsByType = computed(() => {
    const byType: Record<string, Notification[]> = {}
    
    notifications.value.forEach(n => {
      if (!byType[n.type]) {
        byType[n.type] = []
      }
      byType[n.type].push(n)
    })
    
    return byType
  })

  // Methods
  async function fetchNotifications() {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await $fetch<{ ok: boolean; data: Notification[] }>('/api/v1/notifications')
      notifications.value = response.data || []
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch notifications'
      console.error('Failed to fetch notifications:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchNotification(id: number) {
    try {
      isLoading.value = true
      const data = await $fetch<Notification>(`/api/v1/notifications/${id}`)
      
      // Update in list
      const index = notifications.value.findIndex(n => n.id === id)
      if (index !== -1) {
        notifications.value[index] = data
      } else {
        notifications.value.push(data)
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch notification'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createNotification(notificationData: Partial<Notification>) {
    try {
      isLoading.value = true
      const data = await $fetch<Notification>('/api/v1/notifications', {
        method: 'POST',
        body: notificationData
      })
      
      notifications.value.push(data)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to create notification'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateNotification(id: number, notificationData: Partial<Notification>) {
    try {
      isLoading.value = true
      const data = await $fetch<Notification>(`/api/v1/notifications/${id}`, {
        method: 'PUT',
        body: notificationData
      })
      
      // Update in list
      const index = notifications.value.findIndex(n => n.id === id)
      if (index !== -1) {
        notifications.value[index] = data
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to update notification'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteNotification(id: number) {
    try {
      isLoading.value = true
      await $fetch(`/api/v1/notifications/${id}`, {
        method: 'DELETE'
      })
      
      // Remove from list
      notifications.value = notifications.value.filter(n => n.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete notification'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /** Test a saved notification (by id) or an unsaved one (type + config) */
  async function testNotification(target: number | { type: string; config: unknown }) {
    const body = typeof target === 'number'
      ? { notificationId: target }
      : {
          type: target.type,
          // Forms may hand over the config as a JSON string
          config: typeof target.config === 'string' ? JSON.parse(target.config || '{}') : target.config,
        }
    try {
      return await $fetch<{ success: boolean; message?: string }>('/api/v1/notifications/test', {
        method: 'POST',
        body,
      })
    } catch (e: any) {
      throw new Error(e?.data?.message || e.message || 'Test notification failed')
    }
  }

  async function setDefaultNotification(id: number, isDefault: boolean) {
    return updateNotification(id, { isDefault })
  }

  async function toggleNotificationActive(id: number) {
    const notification = notifications.value.find(n => n.id === id)
    if (!notification) return
    
    return updateNotification(id, { active: !notification.active })
  }

  function getNotification(id: number): Notification | undefined {
    return notifications.value.find(n => n.id === id)
  }

  // Auto fetch on mount
  if (autoFetch) {
    onMounted(() => {
      fetchNotifications()
    })
  }

  return {
    // State
    notifications,
    isLoading,
    error,
    
    // Computed
    activeNotifications,
    defaultNotifications,
    notificationsByType,
    
    // Methods
    fetchNotifications,
    fetchNotification,
    createNotification,
    updateNotification,
    deleteNotification,
    testNotification,
    setDefaultNotification,
    toggleNotificationActive,
    getNotification,
  }
}

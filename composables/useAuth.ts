// Auth composable for authentication state and operations
import type { Ref } from 'vue'

interface User {
  id: number
  username: string
  email?: string
  twofa_status?: boolean
  createdAt?: string
}

interface LoginCredentials {
  username: string
  password: string
  token?: string // 2FA token
}

interface UseAuthOptions {
  autoFetch?: boolean
}

export function useAuth(options: UseAuthOptions = {}) {
  const { autoFetch = true } = options

  // State
  const user: Ref<User | null> = ref(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const requires2FA = ref(false)

  // Router
  const router = useRouter()

  // Computed
  const username = computed(() => user.value?.username ?? null)
  const has2FA = computed(() => user.value?.twofa_status ?? false)

  // Methods
  async function checkAuth() {
    try {
      isLoading.value = true
      error.value = null
      
      const data = await $fetch<{ user: User }>('/api/v1/auth/me')
      user.value = data.user
      isAuthenticated.value = true
    } catch (e: any) {
      user.value = null
      isAuthenticated.value = false
      // Don't set error for 401, it's expected when not logged in
      if (e.statusCode !== 401) {
        error.value = e.message
      }
    } finally {
      isLoading.value = false
    }
  }

  async function login(credentials: LoginCredentials) {
    try {
      isLoading.value = true
      error.value = null
      requires2FA.value = false
      
      const response = await $fetch<{ user?: User; requires2FA?: boolean }>('/api/v1/auth/login', {
        method: 'POST',
        body: credentials
      })
      
      if (response.requires2FA) {
        requires2FA.value = true
        return { requires2FA: true }
      }
      
      if (response.user) {
        user.value = response.user
        isAuthenticated.value = true
        return { success: true }
      }
      
      throw new Error('Invalid response')
    } catch (e: any) {
      error.value = e.data?.message || e.message || 'Login failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      isLoading.value = true
      await $fetch('/api/v1/auth/logout', { method: 'POST' })
    } catch (e) {
      // Ignore logout errors
    } finally {
      user.value = null
      isAuthenticated.value = false
      requires2FA.value = false
      isLoading.value = false
      router.push('/login')
    }
  }

  async function verify2FA(token: string) {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await $fetch<{ user: User }>('/api/v1/auth/verify-2fa', {
        method: 'POST',
        body: { token }
      })
      
      user.value = response.user
      isAuthenticated.value = true
      requires2FA.value = false
      
      return { success: true }
    } catch (e: any) {
      error.value = e.data?.message || e.message || '2FA verification failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function setup2FA() {
    try {
      isLoading.value = true
      
      const response = await $fetch<{ 
        qrCodeDataUrl: string
        secretKey: string 
      }>('/api/v1/auth/2fa/setup', {
        method: 'POST'
      })
      
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to setup 2FA'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function enable2FA(token: string) {
    try {
      isLoading.value = true
      
      const response = await $fetch<{ 
        success: boolean
        recoveryCodes: string[] 
      }>('/api/v1/auth/2fa/enable', {
        method: 'POST',
        body: { token }
      })
      
      // Update user state
      if (user.value) {
        user.value.twofa_status = true
      }
      
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to enable 2FA'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function disable2FA(password: string, token: string) {
    try {
      isLoading.value = true
      
      await $fetch('/api/v1/auth/2fa/disable', {
        method: 'POST',
        body: { password, token }
      })
      
      // Update user state
      if (user.value) {
        user.value.twofa_status = false
      }
      
      return { success: true }
    } catch (e: any) {
      error.value = e.message || 'Failed to disable 2FA'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    try {
      isLoading.value = true
      
      await $fetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword }
      })
      
      return { success: true }
    } catch (e: any) {
      error.value = e.message || 'Failed to change password'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  // Auto check auth on mount
  if (autoFetch) {
    onMounted(() => {
      checkAuth()
    })
  }

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    requires2FA,

    // Computed
    username,
    has2FA,

    // Methods
    checkAuth,
    login,
    logout,
    verify2FA,
    setup2FA,
    enable2FA,
    disable2FA,
    changePassword,
  }
}

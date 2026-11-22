<template>
  <div class="login-page">
    <div class="w-full max-w-sm">
      <form @submit.prevent="handleLogin" class="space-y-6">
        <!-- Logo -->
        <div class="text-center">
          <img src="/icon.svg" alt="Uptime Kuma" width="64" height="64" class="mx-auto" />
          <h1 class="text-2xl font-bold text-primary mt-3">Uptime Kuma</h1>
        </div>

        <!-- Username -->
        <div class="form-group">
          <label for="username" class="input-label">Username</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            class="input-field"
            placeholder="Enter your username"
            required
            :disabled="loading"
            autofocus
          />
        </div>

        <!-- Password -->
        <div class="form-group">
          <label for="password" class="input-label">Password</label>
          <div class="relative">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              class="input-field pr-12"
              placeholder="Enter your password"
              required
              :disabled="loading"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center px-3 text-secondary hover:text-primary"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :title="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <UIcon :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- 2FA step -->
        <div v-if="requiresTwoFactor" class="form-group">
          <label for="twofa" class="input-label">2FA code or backup code</label>
          <input
            id="twofa"
            v-model="twoFactorCode"
            type="text"
            class="input-field text-center tracking-widest"
            autocomplete="one-time-code"
            maxlength="9"
            placeholder="000000 or XXXX-XXXX"
            required
          />
          <p class="text-xs text-secondary mt-1">Enter the 6-digit code from your authenticator app, or a backup code.</p>
        </div>

        <!-- Error -->
        <div v-if="error" class="alert alert-danger">
          {{ error }}
        </div>

        <!-- Submit -->
        <button type="submit" class="btn btn-primary w-full mt-4" :disabled="loading">
          <span v-if="loading" class="spinner w-4 h-4 mr-2"></span>
          Login
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { fetch: refreshSession } = useUserSession()

const form = reactive({
  username: '',
  password: '',
})

const loading = ref(false)
const error = ref('')
const showPassword = ref(false)
const requiresTwoFactor = ref(false)
const twoFactorCode = ref('')

onMounted(async () => {
  try {
    const entry = await $fetch<{ setupRequired?: boolean }>('/api/entry-page')
    if (entry.setupRequired) {
      navigateTo('/setup')
    }
  } catch {
    // ignore
  }
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { ...form, ...(requiresTwoFactor.value ? { token: twoFactorCode.value } : {}) },
    })

    if (response.ok) {
      await refreshSession()
      navigateTo('/dashboard')
    } else if ((response as any)?.tokenRequired) {
      requiresTwoFactor.value = true
      error.value = ''
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-primary);
  padding: 1rem;
}
</style>
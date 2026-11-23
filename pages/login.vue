<template>
  <div class="login-page">
    <div class="w-full max-w-sm">
      <form @submit.prevent="handleLogin" class="space-y-6">
        <!-- Brand -->
        <div class="login-brand">
          <img src="/sealwatch-mark.svg" alt="SealWatch" class="login-brand-mark" />
          <div>
            <h1 class="login-brand-title">Seal<span>Watch</span></h1>
            <p class="login-brand-tagline">MONITOR · ALERT · STATUS</p>
          </div>
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

        <!-- Remember me -->
        <label class="flex items-center gap-2 text-sm text-secondary cursor-pointer">
          <input v-model="form.remember" type="checkbox" class="checkbox" />
          {{ $t('Remember me') }}
        </label>

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
  remember: false,
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
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-primary);
  padding: 1rem;
}
.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 15% 20%, rgba(92, 221, 139, 0.16), transparent 45%),
              radial-gradient(circle at 85% 85%, rgba(92, 221, 139, 0.1), transparent 40%);
  pointer-events: none;
}
.login-brand {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
}
.login-brand-mark { width: 4rem; height: 4rem; flex-shrink: 0; }
.login-brand-title {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0b2545;
}
:global(.dark) .login-brand-title { color: #e8f6ee; }
.login-brand-title span {
  background: linear-gradient(90deg, #5cdd8b, #20b26b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.login-brand-tagline {
  margin-top: 0.25rem;
  font-size: 0.625rem;
  letter-spacing: 0.22em;
  font-weight: 600;
  color: var(--text-tertiary);
}
</style>
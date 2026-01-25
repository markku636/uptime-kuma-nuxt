<template>
  <div class="setup-page">
    <div class="w-full max-w-sm">
      <form @submit.prevent="handleSetup" class="space-y-6">
        <!-- Logo -->
        <div class="text-center">
          <img src="/icon.svg" alt="Uptime Kuma" width="64" height="64" class="mx-auto" />
          <h1 class="text-2xl font-bold text-primary mt-3">Uptime Kuma</h1>
          <p class="text-muted mt-2">Create your admin account</p>
        </div>

        <!-- Username -->
        <div class="form-group">
          <label for="username" class="input-label">Username</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            class="input-field"
            placeholder="Enter your username"
            required
            :disabled="loading"
            minlength="3"
          />
        </div>

        <!-- Password -->
        <div class="form-group">
          <label for="password" class="input-label">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            class="input-field"
            placeholder="Enter your password"
            required
            :disabled="loading"
            minlength="6"
          />
        </div>

        <!-- Repeat Password -->
        <div class="form-group">
          <label for="repeatPassword" class="input-label">Repeat Password</label>
          <input
            id="repeatPassword"
            v-model="form.repeatPassword"
            type="password"
            class="input-field"
            placeholder="Repeat your password"
            required
            :disabled="loading"
            minlength="6"
          />
        </div>

        <!-- Error -->
        <div v-if="error" class="alert alert-danger">
          {{ error }}
        </div>

        <!-- Success -->
        <div v-if="success" class="alert alert-success">
          {{ success }}
        </div>

        <!-- Submit -->
        <button type="submit" class="btn btn-primary w-full mt-4" :disabled="loading">
          <span v-if="loading" class="spinner w-4 h-4 mr-2"></span>
          Create Account
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
  repeatPassword: '',
})

const loading = ref(false)
const error = ref('')
const success = ref('')

onMounted(async () => {
  try {
    // Check if setup is already complete
    const entry = await $fetch<{ setupRequired?: boolean }>('/api/entry-page')
    if (!entry.setupRequired) {
      navigateTo('/dashboard')
    }
  } catch {
    // ignore
  }
})

const handleSetup = async () => {
  // Validate passwords match
  if (form.password !== form.repeatPassword) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await $fetch<{ ok: boolean; message: string }>('/api/auth/setup', {
      method: 'POST',
      body: {
        username: form.username,
        password: form.password,
      },
    })

    if (response.ok) {
      success.value = 'Account created successfully! Redirecting...'
      await refreshSession()
      setTimeout(() => {
        navigateTo('/dashboard')
      }, 1000)
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Setup failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-primary);
  padding: 1rem;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid #c3e6cb;
}
</style>

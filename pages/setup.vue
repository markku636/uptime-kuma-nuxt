<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-900 px-4">
    <div class="w-full max-w-sm">
      <form @submit.prevent="handleSetup" class="space-y-6">
        <!-- Logo -->
        <div class="text-center">
          <img src="/icon.svg" alt="Uptime Kuma" width="64" height="64" class="mx-auto" />
          <h1 class="text-2xl font-bold text-gray-100 mt-3">Uptime Kuma</h1>
          <p class="text-gray-400 mt-2">Create your admin account</p>
        </div>

        <!-- Username -->
        <div class="form-group">
          <label for="username" class="input-label">Username</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            class="input-field"
            placeholder="Choose a username"
            required
            :disabled="loading"
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
            placeholder="Choose a password"
            required
            :disabled="loading"
          />
        </div>

        <!-- Confirm Password -->
        <div class="form-group">
          <label for="confirmPassword" class="input-label">Repeat Password</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            class="input-field"
            placeholder="Repeat your password"
            required
            :disabled="loading"
          />
        </div>

        <!-- Error -->
        <div v-if="error" class="alert alert-danger">
          {{ error }}
        </div>

        <!-- Submit -->
        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
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
  confirmPassword: '',
})

const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const entry = await $fetch<{ setupRequired?: boolean }>('/api/entry-page')
    if (!entry.setupRequired) {
      navigateTo('/login')
    }
  } catch {
    // ignore
  }
})

const handleSetup = async () => {
  if (form.password !== form.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/auth/setup', {
      method: 'POST',
      body: {
        username: form.username,
        password: form.password,
      },
    })

    if (response.ok) {
      await refreshSession()
      navigateTo('/dashboard')
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Setup failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-900 px-4">
    <div class="w-full max-w-sm">
      <form @submit.prevent="handleLogin" class="space-y-6">
        <!-- Logo -->
        <div class="text-center">
          <img src="/icon.svg" alt="Uptime Kuma" width="64" height="64" class="mx-auto" />
          <h1 class="text-2xl font-bold text-gray-100 mt-3">Uptime Kuma</h1>
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
          />
        </div>

        <!-- Error -->
        <div v-if="error" class="alert alert-danger">
          {{ error }}
        </div>

        <!-- Submit -->
        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
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
      body: form,
    })

    if (response.ok) {
      await refreshSession()
      navigateTo('/dashboard')
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

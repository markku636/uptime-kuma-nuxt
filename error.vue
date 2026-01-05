<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-900">
    <div class="text-center">
      <div class="mb-8">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-24 h-24 mx-auto text-yellow-500" />
      </div>
      
      <h1 class="text-6xl font-bold text-white mb-4">
        {{ error?.statusCode || 404 }}
      </h1>
      
      <h2 class="text-2xl font-semibold text-gray-300 mb-4">
        {{ errorTitle }}
      </h2>
      
      <p class="text-gray-400 mb-8 max-w-md mx-auto">
        {{ errorMessage }}
      </p>
      
      <div class="flex gap-4 justify-center">
        <UButton
          color="primary"
          size="lg"
          @click="handleBack"
        >
          <UIcon name="i-heroicons-arrow-left" class="mr-2" />
          Go Back
        </UButton>
        
        <UButton
          variant="outline"
          size="lg"
          @click="handleHome"
        >
          <UIcon name="i-heroicons-home" class="mr-2" />
          Home
        </UButton>
      </div>
      
      <!-- Debug info in development -->
      <div v-if="isDev && error?.stack" class="mt-8 text-left max-w-2xl mx-auto">
        <details class="bg-gray-800 rounded-lg p-4">
          <summary class="text-gray-400 cursor-pointer">Stack Trace</summary>
          <pre class="mt-4 text-xs text-red-400 overflow-auto">{{ error.stack }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const isDev = process.dev

const errorTitle = computed(() => {
  const statusCode = props.error?.statusCode || 404
  switch (statusCode) {
    case 404:
      return 'Page Not Found'
    case 403:
      return 'Access Forbidden'
    case 500:
      return 'Server Error'
    default:
      return 'An Error Occurred'
  }
})

const errorMessage = computed(() => {
  const statusCode = props.error?.statusCode || 404
  if (props.error?.message && props.error.message !== String(statusCode)) {
    return props.error.message
  }
  switch (statusCode) {
    case 404:
      return "The page you're looking for doesn't exist or has been moved."
    case 403:
      return "You don't have permission to access this resource."
    case 500:
      return 'Something went wrong on our end. Please try again later.'
    default:
      return 'An unexpected error occurred. Please try again.'
  }
})

const handleBack = () => {
  if (window.history.length > 2) {
    window.history.back()
  } else {
    navigateTo('/')
  }
}

const handleHome = () => {
  clearError({ redirect: '/' })
}
</script>

<style scoped>
/* Minimal animation */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.i-heroicons-exclamation-triangle {
  animation: float 3s ease-in-out infinite;
}
</style>

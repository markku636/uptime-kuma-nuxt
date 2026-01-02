<script setup lang="ts">
const router = useRouter()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="text-center">
      <div class="mb-8">
        <span class="text-9xl font-bold text-gray-200 dark:text-gray-800">404</span>
      </div>
      
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Page Not Found
      </h1>
      
      <p class="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
        Oops! The page you're looking for doesn't exist or has been moved.
      </p>
      
      <div class="flex items-center justify-center gap-4">
        <UButton
          variant="outline"
          icon="i-heroicons-arrow-left"
          @click="router.back()"
        >
          Go Back
        </UButton>
        <UButton
          icon="i-heroicons-home"
          to="/dashboard"
        >
          Go to Dashboard
        </UButton>
      </div>
    </div>
  </div>
</template>

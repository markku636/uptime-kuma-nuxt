<template>
  <div class="loading-container">
    <div class="text-center">
      <img src="/icon.svg" alt="Uptime Kuma" width="64" height="64" class="mb-3" />
      <div class="spinner mx-auto size-8" role="status">
        <span class="sr-only">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const { loggedIn } = useUserSession()

// Check entry page on mount
onMounted(async () => {
  await checkEntryPage()
})

async function checkEntryPage() {
  try {
    const entry = await $fetch<{ entryPage: string; statusPageSlug?: string | null; setupRequired?: boolean }>(
      '/api/entry-page',
    )

    // If no users exist, go to setup
    if (entry.setupRequired) {
      return navigateTo('/setup', { replace: true })
    }

    // If logged in, go to dashboard
    if (loggedIn.value) {
      return navigateTo('/dashboard', { replace: true })
    }

    // Not logged in, go to login
    return navigateTo('/login', { replace: true })
  } catch (error) {
    console.error('Failed to check entry page:', error)
    // Fallback: check if logged in
    if (loggedIn.value) {
      navigateTo('/dashboard', { replace: true })
    } else {
      navigateTo('/login', { replace: true })
    }
  }
}
</script>

<style scoped>
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--uk-bg-sunken);
}

.spinner-border {
  width: 2rem;
  height: 2rem;
}

.text-primary {
  color: var(--uk-status-up-fg) !important;
}
</style>

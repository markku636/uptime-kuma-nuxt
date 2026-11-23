<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const platformAdmin = ref(false)
const permissionReady = ref(false)

onMounted(async () => {
  try {
    platformAdmin.value = !!(await $fetch<{ data?: { platformAdmin?: boolean } }>('/api/auth/session')).data?.platformAdmin
  } finally {
    permissionReady.value = true
  }
})
</script>

<template>
  <p v-if="!permissionReady">Loading permissions…</p>
  <p v-else-if="!platformAdmin" role="status">Platform administrator permission required.</p>
  <SettingsWorkerRuntime v-else />
</template>

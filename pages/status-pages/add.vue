<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

// The full add/edit editor lives at pages/status-pages/[id]/edit.vue.
// `new` is its create mode; the old <StatusPagesEdit /> component does not exist.
await navigateTo('/status-pages/new/edit', { replace: true })
</script>

<template>
  <div />
</template>

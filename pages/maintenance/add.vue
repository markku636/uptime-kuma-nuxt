<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

// /maintenance/add?cloneId=3 prefills from an existing maintenance
const route = useRoute()
const cloneId = computed(() => Number(route.query.cloneId) || undefined)
const monitorId = computed(() => Number(route.query.monitorId) || undefined)
</script>

<template>
  <MaintenanceForm :key="cloneId ?? 'new'" :clone-id="cloneId" :monitor-id="monitorId" />
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const id = computed(() => Number(route.params.id))
</script>

<template>
  <MaintenanceForm :key="id" :id="id" />
</template>

<script setup lang="ts">
definePageMeta({middleware:['auth']})
const router=useRouter(),{canEdit}=useWorkspace()
</script>
<template><div class="max-w-3xl mx-auto"><h1 class="text-2xl font-semibold mb-2">Schedule maintenance</h1><p class="text-gray-400 mb-6">Pause checks during a planned window.</p><div class="card p-5 sm:p-7"><MaintenanceForm v-if="canEdit" @saved="router.push('/maintenance')" @cancel="router.push('/maintenance')" /><p v-else>Editor access is required.</p></div></div></template>

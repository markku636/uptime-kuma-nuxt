<script setup lang="ts">
definePageMeta({middleware:['auth']})
const route=useRoute(),router=useRouter(),{canEdit}=useWorkspace()
const {data,pending,error}=await useFetch<any>(`/api/v1/maintenances/${route.params.id}`,{headers:useRequestHeaders(['cookie'])})
</script>
<template><div class="max-w-3xl mr-auto"><h1 class="text-2xl font-semibold mb-6">Edit maintenance</h1><p v-if="pending">Loading…</p><p v-else-if="error" role="alert">Unable to load maintenance.</p><div v-else-if="canEdit&&data?.data" class="card p-5 sm:p-7"><MaintenanceForm :maintenance="data.data" @saved="router.push('/maintenance')" @cancel="router.push('/maintenance')" /></div><p v-else>Editor access is required.</p></div></template>

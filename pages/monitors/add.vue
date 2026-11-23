<script setup lang="ts">
definePageMeta({middleware:['auth']})
const loading=ref(false),toast=useToast(),router=useRouter(),store=useMonitorStore()
const provisioning=ref<string|null>(null)
async function handleSubmit(body:any){
  loading.value=true
  try{
    const response=await $fetch<any>('/api/v1/monitors',{method:'POST',body})
    store.updateMonitor(response.data)
    if(response.provisioning?.pushToken){provisioning.value=`${location.origin}/api/push/${response.provisioning.pushToken}`;return}
    toast.add({title:'Monitor created',color:'success'});await router.push(`/monitors/${response.data.id}`)
  }catch(error:any){toast.add({title:'Unable to create monitor',description:error.data?.message||'Request failed',color:'error'})}
  finally{loading.value=false}
}
</script>
<template>
  <div class="max-w-4xl mr-auto space-y-6">
    <h1 class="text-2xl font-bold">Add Monitor</h1>
    <div v-if="provisioning" class="section-card space-y-3"><p>Save this push URL. Editors can view it again on the monitor detail page.</p><code class="break-all">{{ provisioning }}</code><UButton to="/dashboard">Continue to dashboard</UButton></div>
    <MonitorForm v-else :loading="loading" @submit="handleSubmit" />
  </div>
</template>

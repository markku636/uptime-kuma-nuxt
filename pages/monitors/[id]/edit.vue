<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const monitorStore = useMonitorStore()

const monitorId = computed(() => Number(route.params.id))
const monitor = ref<any>(null)
const loading = ref(true)
const saving = ref(false)

// Fetch monitor data
onMounted(async () => {
  try {
    const data = await $fetch(`/api/v1/monitors/${monitorId.value}`)
    monitor.value = data
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to load monitor',
      color: 'error'
    })
    router.push('/monitors')
  } finally {
    loading.value = false
  }
})

async function handleSubmit(formData: any) {
  saving.value = true
  try {
    const updated = await $fetch(`/api/v1/monitors/${monitorId.value}`, {
      method: 'PUT',
      body: formData
    })
    
    monitorStore.updateMonitor(updated)
    
    toast.add({
      title: 'Success',
      description: 'Monitor updated successfully',
      color: 'success'
    })
    
    router.push('/monitors')
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update monitor',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-6">
      <UButton
        to="/monitors"
        variant="ghost"
        icon="i-heroicons-arrow-left"
        class="mb-4"
      >
        Back to Monitors
      </UButton>
      <h1 class="text-2xl font-bold">Edit Monitor</h1>
    </div>

    <UCard v-if="loading">
      <div class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
      </div>
    </UCard>

    <MonitorForm
      v-else-if="monitor"
      :initial-data="monitor"
      :loading="saving"
      @submit="handleSubmit"
    />
  </div>
</template>

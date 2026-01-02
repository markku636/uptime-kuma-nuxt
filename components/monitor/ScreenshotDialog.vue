<template>
  <UModal v-model:open="isOpen" title="Screenshot" size="xl">
    <template #body>
      <div class="space-y-4">
        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin w-8 h-8 text-gray-400" />
        </div>

        <!-- Screenshot -->
        <div v-else-if="screenshotUrl" class="relative">
          <img 
            :src="screenshotUrl" 
            :alt="`Screenshot of ${monitorName}`"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-700"
          />
          <div class="absolute bottom-2 right-2 flex gap-2">
            <UButton 
              icon="i-heroicons-arrow-path" 
              variant="soft" 
              size="sm"
              @click="refresh"
              :loading="refreshing"
            >
              Refresh
            </UButton>
            <UButton 
              icon="i-heroicons-arrow-down-tray" 
              variant="soft" 
              size="sm"
              @click="download"
            >
              Download
            </UButton>
          </div>
        </div>

        <!-- No screenshot available -->
        <div v-else class="flex flex-col items-center justify-center py-12 text-gray-500">
          <UIcon name="i-heroicons-photo" class="w-16 h-16 mb-4" />
          <p>No screenshot available</p>
          <p class="text-sm mt-1">Screenshots are only available for Real Browser monitors</p>
        </div>

        <!-- Screenshot info -->
        <div v-if="screenshotTime" class="text-sm text-gray-500 text-center">
          Captured at: {{ formatDateTime(screenshotTime) }}
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="flex justify-end">
        <UButton variant="ghost" @click="close">
          Close
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  monitorId?: number
  monitorName?: string
}

const props = withDefaults(defineProps<Props>(), {
  monitorId: 0,
  monitorName: 'Monitor'
})

const emit = defineEmits<{
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const loading = ref(true)
const refreshing = ref(false)
const screenshotUrl = ref<string | null>(null)
const screenshotTime = ref<Date | null>(null)

// Fetch screenshot when opening
watch(isOpen, async (newVal) => {
  if (newVal && props.monitorId) {
    await fetchScreenshot()
  }
})

async function fetchScreenshot() {
  loading.value = true
  try {
    const result = await $fetch(`/api/v1/monitors/${props.monitorId}/screenshot`)
    screenshotUrl.value = result.url || null
    screenshotTime.value = result.time ? new Date(result.time) : null
  } catch (error: any) {
    screenshotUrl.value = null
    // Don't show error for missing screenshots
  } finally {
    loading.value = false
  }
}

async function refresh() {
  refreshing.value = true
  try {
    await $fetch(`/api/v1/monitors/${props.monitorId}/screenshot/capture`, {
      method: 'POST'
    })
    
    // Wait a bit for the screenshot to be captured
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    await fetchScreenshot()
    
    toast.add({
      title: 'Success',
      description: 'Screenshot refreshed',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to capture screenshot',
      color: 'error'
    })
  } finally {
    refreshing.value = false
  }
}

function download() {
  if (!screenshotUrl.value) return
  
  const link = document.createElement('a')
  link.href = screenshotUrl.value
  link.download = `screenshot-${props.monitorName}-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function formatDateTime(date: Date): string {
  return date.toLocaleString()
}

function close() {
  isOpen.value = false
  emit('closed')
}
</script>

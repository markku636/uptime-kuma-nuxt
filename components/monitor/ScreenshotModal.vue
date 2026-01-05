<template>
  <UModal v-model="isOpen" :ui="{ width: 'max-w-4xl' }">
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-100">
          Browser Screenshot
        </h3>
        <button @click="isOpen = false" class="text-gray-400 hover:text-gray-200">
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="spinner w-10 h-10"></div>
      </div>

      <div v-else-if="error" class="text-center py-20">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-16 h-16 text-red-400 mx-auto mb-4" />
        <p class="text-gray-400">{{ error }}</p>
        <button @click="loadScreenshot" class="btn btn-primary mt-4">Retry</button>
      </div>

      <div v-else-if="imageUrl" class="relative">
        <img 
          :src="imageUrl" 
          alt="Browser Screenshot" 
          class="w-full rounded-lg shadow-lg"
          @load="onImageLoad"
          @error="onImageError"
        />
        <div class="absolute top-2 right-2 flex gap-2">
          <button @click="openInNewTab" class="btn btn-sm bg-black/50 hover:bg-black/70 text-white">
            <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4" />
          </button>
          <button @click="downloadScreenshot" class="btn btn-sm bg-black/50 hover:bg-black/70 text-white">
            <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex justify-between items-center mt-4">
        <span v-if="timestamp" class="text-sm text-gray-500">
          Captured: {{ formatDateTime(timestamp) }}
        </span>
        <div class="flex gap-2">
          <button @click="loadScreenshot" :disabled="loading" class="btn btn-secondary">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" :class="{ 'animate-spin': loading }" />
            Refresh
          </button>
          <button @click="isOpen = false" class="btn btn-primary">Close</button>
        </div>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

const props = defineProps<{
  monitorId: number
}>()

const isOpen = defineModel<boolean>({ default: false })

const imageUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const timestamp = ref<Date | null>(null)

const formatDateTime = (date: Date | null) => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const loadScreenshot = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await $fetch<{ url: string; timestamp: string }>(`/api/v1/monitors/${props.monitorId}/screenshot`)
    imageUrl.value = response.url
    timestamp.value = new Date(response.timestamp)
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to load screenshot'
  } finally {
    loading.value = false
  }
}

const onImageLoad = () => {
  // Image loaded successfully
}

const onImageError = () => {
  error.value = 'Failed to load screenshot image'
}

const openInNewTab = () => {
  if (imageUrl.value) {
    window.open(imageUrl.value, '_blank')
  }
}

const downloadScreenshot = () => {
  if (imageUrl.value) {
    const link = document.createElement('a')
    link.href = imageUrl.value
    link.download = `screenshot-${props.monitorId}-${Date.now()}.png`
    link.click()
  }
}

watch(isOpen, (newVal) => {
  if (newVal && !imageUrl.value) {
    loadScreenshot()
  }
})
</script>

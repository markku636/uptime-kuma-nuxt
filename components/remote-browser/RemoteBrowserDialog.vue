<template>
  <UModal v-model:open="isOpen" :title="isEdit ? 'Edit Remote Browser' : 'Add Remote Browser'" size="lg">
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormField label="Name" required>
          <UInput 
            v-model="formData.name" 
            placeholder="e.g., Chrome Browser"
            class="w-full"
          />
        </UFormField>

        <UFormField label="URL" required>
          <UInput 
            v-model="formData.url" 
            placeholder="ws://localhost:3000 or http://browserless:3000"
            class="w-full"
          />
          <template #hint>
            URL to the remote browser instance (WebSocket or HTTP)
          </template>
        </UFormField>

        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 class="font-medium mb-2 flex items-center gap-2">
            <UIcon name="i-heroicons-information-circle" />
            Remote Browser Services
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Supported remote browser services:
          </p>
          <ul class="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
            <li><strong>Browserless</strong> - ws://browserless:3000</li>
            <li><strong>Playwright Server</strong> - ws://playwright:3000</li>
            <li><strong>Chrome DevTools Protocol</strong> - ws://chrome:9222</li>
          </ul>
        </div>

        <div class="flex justify-end gap-2 pt-4">
          <UButton variant="ghost" @click="close">
            Cancel
          </UButton>
          <UButton 
            variant="soft"
            @click="testConnection"
            :loading="testing"
          >
            Test Connection
          </UButton>
          <UButton type="submit" color="primary" :loading="loading">
            {{ isEdit ? 'Save' : 'Add' }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface RemoteBrowser {
  id?: number
  name: string
  url: string
}

interface Props {
  remoteBrowser?: RemoteBrowser | null
}

const props = withDefaults(defineProps<Props>(), {
  remoteBrowser: null
})

const emit = defineEmits<{
  saved: [remoteBrowser: RemoteBrowser]
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const loading = ref(false)
const testing = ref(false)

const isEdit = computed(() => !!props.remoteBrowser?.id)

const defaultFormData = {
  name: '',
  url: ''
}

const formData = ref({ ...defaultFormData })

// Watch for remoteBrowser changes
watch(() => props.remoteBrowser, (newVal) => {
  if (newVal) {
    formData.value = {
      name: newVal.name || '',
      url: newVal.url || ''
    }
  } else {
    formData.value = { ...defaultFormData }
  }
}, { immediate: true })

// Reset when opening
watch(isOpen, (newVal) => {
  if (newVal && !props.remoteBrowser) {
    formData.value = { ...defaultFormData }
  }
})

async function testConnection() {
  if (!formData.value.url) {
    toast.add({
      title: 'Validation Error',
      description: 'URL is required to test connection',
      color: 'error'
    })
    return
  }

  testing.value = true
  try {
    await $fetch('/api/v1/remote-browsers/test', {
      method: 'POST',
      body: { url: formData.value.url }
    })
    
    toast.add({
      title: 'Success',
      description: 'Connection successful!',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Connection Failed',
      description: error.message || 'Could not connect to remote browser',
      color: 'error'
    })
  } finally {
    testing.value = false
  }
}

async function handleSubmit() {
  if (!formData.value.name.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Name is required',
      color: 'error'
    })
    return
  }

  if (!formData.value.url.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'URL is required',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    let result
    if (isEdit.value && props.remoteBrowser?.id) {
      result = await $fetch(`/api/v1/remote-browsers/${props.remoteBrowser.id}`, {
        method: 'PUT',
        body: formData.value
      })
      toast.add({
        title: 'Success',
        description: 'Remote browser updated successfully',
        color: 'success'
      })
    } else {
      result = await $fetch('/api/v1/remote-browsers', {
        method: 'POST',
        body: formData.value
      })
      toast.add({
        title: 'Success',
        description: 'Remote browser added successfully',
        color: 'success'
      })
    }

    emit('saved', result)
    close()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to save remote browser',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function close() {
  isOpen.value = false
  emit('closed')
}
</script>

<template>
  <UModal v-model:open="isOpen" title="Create API Key" size="lg">
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormField label="Name" required>
          <UInput 
            v-model="formData.name" 
            placeholder="Enter a name for this API key"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Expiration (Optional)">
          <UInput 
            v-model="formData.expires" 
            type="datetime-local"
            class="w-full"
          />
          <template #hint>
            Leave empty for no expiration
          </template>
        </UFormField>

        <div v-if="createdKey" class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-heroicons-check-circle" class="text-green-500" />
            <span class="font-medium text-green-700 dark:text-green-300">API Key Created Successfully</span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Make sure to copy your API key now. You won't be able to see it again!
          </p>
          <div class="flex items-center gap-2">
            <code class="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono break-all">
              {{ createdKey }}
            </code>
            <UButton 
              icon="i-heroicons-clipboard-document" 
              variant="ghost" 
              @click="copyKey"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4">
          <UButton variant="ghost" @click="close">
            {{ createdKey ? 'Done' : 'Cancel' }}
          </UButton>
          <UButton 
            v-if="!createdKey"
            type="submit" 
            color="primary" 
            :loading="loading"
          >
            Create API Key
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  created: [apiKey: any]
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const loading = ref(false)
const createdKey = ref('')

const formData = ref({
  name: '',
  expires: ''
})

// Reset when opening
watch(isOpen, (newVal) => {
  if (newVal) {
    formData.value = { name: '', expires: '' }
    createdKey.value = ''
  }
})

async function handleSubmit() {
  if (!formData.value.name.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'API key name is required',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    const data: any = { name: formData.value.name }
    if (formData.value.expires) {
      data.expires = new Date(formData.value.expires).toISOString()
    }

    const result = await $fetch('/api/v1/api-keys', {
      method: 'POST',
      body: data
    })

    createdKey.value = result.key
    emit('created', result)
    
    toast.add({
      title: 'Success',
      description: 'API key created successfully',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to create API key',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(createdKey.value)
    toast.add({
      title: 'Copied',
      description: 'API key copied to clipboard',
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to copy to clipboard',
      color: 'error'
    })
  }
}

function close() {
  isOpen.value = false
  emit('closed')
}
</script>

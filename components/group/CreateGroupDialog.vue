<template>
  <UModal v-model:open="isOpen" title="Create Group" size="md">
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormField label="Group Name" required>
          <UInput 
            v-model="formData.name" 
            placeholder="Enter group name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Description">
          <UTextarea 
            v-model="formData.description" 
            placeholder="Optional description for this group"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-4">
          <UButton variant="ghost" @click="close">
            Cancel
          </UButton>
          <UButton type="submit" color="primary" :loading="loading">
            Create Group
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Group {
  id?: number
  name: string
  description?: string
}

const emit = defineEmits<{
  created: [group: Group]
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const loading = ref(false)

const formData = ref({
  name: '',
  description: ''
})

// Reset when opening
watch(isOpen, (newVal) => {
  if (newVal) {
    formData.value = { name: '', description: '' }
  }
})

async function handleSubmit() {
  if (!formData.value.name.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Group name is required',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    // Create a group monitor (type: group)
    const result = await $fetch('/api/v1/monitors', {
      method: 'POST',
      body: {
        name: formData.value.name,
        type: 'group',
        description: formData.value.description || null,
        active: true
      }
    })

    emit('created', {
      id: result.id,
      name: result.name,
      description: result.description
    })
    
    toast.add({
      title: 'Success',
      description: 'Group created successfully',
      color: 'success'
    })
    
    close()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to create group',
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

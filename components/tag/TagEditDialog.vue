<template>
  <UModal 
    :open="isOpen"
    @update:open="isOpen = $event"
    :title="isEdit ? 'Edit Tag' : 'Add Tag'" 
    :ui="{ footer: 'justify-end' }"
  >
    <template #default>
      <span class="hidden"></span>
    </template>
    
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormField label="Tag Name" required>
          <UInput 
            v-model="formData.name" 
            placeholder="Enter tag name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Color">
          <div class="flex items-center gap-3">
            <input 
              type="color" 
              v-model="formData.color"
              class="w-12 h-10 rounded border border-accented cursor-pointer"
            />
            <UInput 
              v-model="formData.color" 
              placeholder="#808080"
              class="flex-1"
            />
          </div>
        </UFormField>

        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">Preview:</span>
          <Tag :tag="{ ...formData, id: 0 }" />
        </div>
      </form>
    </template>
    
    <template #footer="{ close }">
      <UButton variant="ghost" @click="close">
        Cancel
      </UButton>
      <UButton @click="handleSubmit" color="primary" :loading="loading">
        {{ isEdit ? 'Save' : 'Create' }}
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Tag as TagType } from '~/types'

interface Props {
  tag?: TagType | null
}

const props = withDefaults(defineProps<Props>(), {
  tag: null
})

const emit = defineEmits<{
  saved: [tag: TagType]
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const { addTag, updateTag } = useTags()
const loading = ref(false)

const isEdit = computed(() => !!props.tag?.id)

const defaultFormData = {
  name: '',
  color: '#808080'
}

const formData = ref({ ...defaultFormData })

// Watch for tag changes
watch(() => props.tag, (newVal) => {
  if (newVal) {
    formData.value = {
      name: newVal.name || '',
      color: newVal.color || '#808080'
    }
  } else {
    formData.value = { ...defaultFormData }
  }
}, { immediate: true })

// Reset when opening
watch(isOpen, (newVal) => {
  if (newVal && !props.tag) {
    formData.value = { ...defaultFormData }
  }
})

async function handleSubmit() {
  if (!formData.value.name.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Tag name is required',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    let result
    if (isEdit.value && props.tag?.id) {
      result = await updateTag(props.tag.id, formData.value)
      toast.add({
        title: 'Success',
        description: 'Tag updated successfully',
        color: 'success'
      })
    } else {
      result = await addTag(formData.value)
      toast.add({
        title: 'Success',
        description: 'Tag created successfully',
        color: 'success'
      })
    }

    emit('saved', result)
    close()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to save tag',
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

<template>
  <UModal 
    :open="isOpen"
    @update:open="isOpen = $event"
    :title="isEdit ? 'Edit Incident' : 'Post Incident'" 
    :ui="{ footer: 'justify-end' }"
  >
    <template #default>
      <span class="hidden"></span>
    </template>
    
    <template #body>
      <form id="incident-form" @submit.prevent="handleSubmit" class="space-y-4">
        <UFormField label="Title" required>
          <UInput 
            v-model="formData.title" 
            placeholder="Brief description of the incident"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Content" required>
          <UTextarea 
            v-model="formData.content" 
            placeholder="Detailed information about the incident..."
            :rows="5"
            class="w-full"
          />
          <template #hint>
            Markdown is supported
          </template>
        </UFormField>

        <UFormField label="Style">
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="style in styles"
              :key="style.value"
              type="button"
              :class="[
                'p-3 rounded-lg border-2 transition-colors text-center',
                formData.style === style.value 
                  ? 'border-primary-500' 
                  : 'border-default hover:border-accented'
              ]"
              @click="formData.style = style.value"
            >
              <UIcon :name="style.icon" :class="['w-6 h-6 mx-auto mb-1', style.color]" />
              <span class="text-xs">{{ style.label }}</span>
            </button>
          </div>
        </UFormField>

        <UFormField>
          <UCheckbox 
            v-model="formData.pin" 
            label="Pin this incident"
          />
          <template #hint>
            Pinned incidents appear at the top of the status page
          </template>
        </UFormField>
      </form>
    </template>
    
    <template #footer="{ close }">
      <UButton variant="ghost" @click="close">
        Cancel
      </UButton>
      <UButton type="submit" form="incident-form" color="primary" :loading="loading">
        {{ isEdit ? 'Update' : 'Post' }} Incident
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Incident {
  id?: number
  title: string
  content: string
  style: string
  pin: boolean
}

interface Props {
  incident?: Incident | null
  statusPageSlug: string
}

const props = withDefaults(defineProps<Props>(), {
  incident: null,
  statusPageSlug: ''
})

const emit = defineEmits<{
  saved: [incident: Incident]
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const loading = ref(false)

const isEdit = computed(() => !!props.incident?.id)

const styles = [
  { value: 'info', label: 'Info', icon: 'i-heroicons-information-circle', color: 'text-blue-500' },
  { value: 'warning', label: 'Warning', icon: 'i-heroicons-exclamation-triangle', color: 'text-pending-fg' },
  { value: 'danger', label: 'Danger', icon: 'i-heroicons-x-circle', color: 'text-down-fg' },
  { value: 'primary', label: 'Primary', icon: 'i-heroicons-check-circle', color: 'text-primary-500' }
]

const defaultFormData = {
  title: '',
  content: '',
  style: 'info',
  pin: true
}

const formData = ref({ ...defaultFormData })

// Watch for incident changes
watch(() => props.incident, (newVal) => {
  if (newVal) {
    formData.value = {
      title: newVal.title || '',
      content: newVal.content || '',
      style: newVal.style || 'info',
      pin: newVal.pin ?? true
    }
  } else {
    formData.value = { ...defaultFormData }
  }
}, { immediate: true })

// Reset when opening
watch(isOpen, (newVal) => {
  if (newVal && !props.incident) {
    formData.value = { ...defaultFormData }
  }
})

async function handleSubmit() {
  if (!formData.value.title.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Title is required',
      color: 'error'
    })
    return
  }

  if (!formData.value.content.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Content is required',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    let result
    if (isEdit.value && props.incident?.id) {
      result = await $fetch(`/api/v1/status-pages/${props.statusPageSlug}/incidents/${props.incident.id}`, {
        method: 'PUT',
        body: formData.value
      })
      toast.add({
        title: 'Success',
        description: 'Incident updated successfully',
        color: 'success'
      })
    } else {
      result = await $fetch(`/api/v1/status-pages/${props.statusPageSlug}/incidents`, {
        method: 'POST',
        body: formData.value
      })
      toast.add({
        title: 'Success',
        description: 'Incident posted successfully',
        color: 'success'
      })
    }

    emit('saved', result)
    close()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to save incident',
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

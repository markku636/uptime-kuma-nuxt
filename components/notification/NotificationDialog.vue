<template>
  <UModal v-model:open="isOpen" :title="isEdit ? 'Edit Notification' : 'Add Notification'" size="2xl">
    <template #body>
      <NotificationForm
        v-model="formData"
        :notification-id="notification?.id"
        @submit="handleSubmit"
        @cancel="close"
        @test="handleTest"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Notification } from '~/types'

interface Props {
  notification?: Notification | null
}

const props = withDefaults(defineProps<Props>(), {
  notification: null
})

const emit = defineEmits<{
  saved: [notification: Notification]
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const { addNotification, updateNotification, testNotification } = useNotifications()

const isEdit = computed(() => !!props.notification?.id)

const defaultFormData = {
  name: '',
  type: 'webhook',
  isDefault: false,
  active: true,
  config: {}
}

const formData = ref({ ...defaultFormData })

// Watch for notification changes
watch(() => props.notification, (newVal) => {
  if (newVal) {
    formData.value = {
      name: newVal.name || '',
      type: newVal.type || 'webhook',
      isDefault: newVal.isDefault ?? false,
      active: newVal.active ?? true,
      config: typeof newVal.config === 'string' ? JSON.parse(newVal.config) : newVal.config || {}
    }
  } else {
    formData.value = { ...defaultFormData }
  }
}, { immediate: true })

// Reset when opening
watch(isOpen, (newVal) => {
  if (newVal && !props.notification) {
    formData.value = { ...defaultFormData }
  }
})

async function handleSubmit() {
  try {
    const data = {
      ...formData.value,
      config: JSON.stringify(formData.value.config)
    }

    let result
    if (isEdit.value && props.notification?.id) {
      result = await updateNotification(props.notification.id, data)
      toast.add({
        title: 'Success',
        description: 'Notification updated successfully',
        color: 'success'
      })
    } else {
      result = await addNotification(data)
      toast.add({
        title: 'Success',
        description: 'Notification created successfully',
        color: 'success'
      })
    }

    emit('saved', result)
    close()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to save notification',
      color: 'error'
    })
  }
}

async function handleTest() {
  try {
    const data = {
      ...formData.value,
      config: JSON.stringify(formData.value.config)
    }

    await testNotification(data)
    toast.add({
      title: 'Success',
      description: 'Test notification sent successfully',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to send test notification',
      color: 'error'
    })
  }
}

function close() {
  isOpen.value = false
  emit('closed')
}
</script>

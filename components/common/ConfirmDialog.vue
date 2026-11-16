<script setup lang="ts">
interface Props {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm',
  message: 'Are you sure?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  type: 'danger',
  loading: false
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const iconConfig = computed(() => {
  switch (props.type) {
    case 'danger':
      return {
        name: 'i-heroicons-exclamation-triangle',
        bgColor: 'bg-down-subtle',
        iconColor: 'text-down-fg'
      }
    case 'warning':
      return {
        name: 'i-heroicons-exclamation-circle',
        bgColor: 'bg-pending-subtle',
        iconColor: 'text-pending-fg'
      }
    default:
      return {
        name: 'i-heroicons-information-circle',
        bgColor: 'bg-maintenance-subtle',
        iconColor: 'text-maintenance-fg'
      }
  }
})

const confirmButtonColor = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'error'
    case 'warning':
      return 'warning'
    default:
      return 'primary'
  }
})

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  open.value = false
  emit('cancel')
}
</script>

<template>
  <UModal 
    :open="open"
    @update:open="open = $event"
    :title="title"
    :description="message"
    :ui="{ footer: 'justify-end' }"
  >
    <template #default>
      <span class="hidden"></span>
    </template>

    <template #footer="{ close }">
      <UButton
        variant="ghost"
        :disabled="loading"
        @click="handleCancel"
      >
        {{ cancelText }}
      </UButton>
      <UButton
        :color="confirmButtonColor"
        :loading="loading"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </UButton>
    </template>
  </UModal>
</template>

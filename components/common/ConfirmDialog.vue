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
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        iconColor: 'text-red-600 dark:text-red-400'
      }
    case 'warning':
      return {
        name: 'i-heroicons-exclamation-circle',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        iconColor: 'text-yellow-600 dark:text-yellow-400'
      }
    default:
      return {
        name: 'i-heroicons-information-circle',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400'
      }
  }
})

const confirmButtonColor = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'red'
    case 'warning':
      return 'yellow'
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
  <UModal v-model:open="open">
    <div class="p-6">
      <div class="flex items-start gap-4">
        <!-- Icon -->
        <div :class="['p-3 rounded-full', iconConfig.bgColor]">
          <UIcon :name="iconConfig.name" :class="['w-6 h-6', iconConfig.iconColor]" />
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ title }}
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ message }}
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-6 flex justify-end gap-3">
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
      </div>
    </div>
  </UModal>
</template>

<template>
  <div class="action-input" :class="{ 'opacity-50': disabled }">
    <div class="flex items-center gap-2">
      <div class="flex-1">
        <slot>
          <UInput
            v-model="modelValue"
            :placeholder="placeholder"
            :disabled="disabled || loading"
            :type="type"
            v-bind="$attrs"
          />
        </slot>
      </div>
      
      <UButton
        :color="actionColor"
        :variant="actionVariant"
        :icon="actionIcon"
        :loading="loading"
        :disabled="disabled || (requireConfirm && !isConfirmed)"
        @click="handleAction"
      >
        {{ actionLabel }}
      </UButton>
    </div>

    <!-- Confirmation Checkbox -->
    <div v-if="requireConfirm" class="mt-2">
      <UCheckbox
        v-model="isConfirmed"
        :label="confirmLabel || $t('I understand the consequences')"
        :disabled="disabled"
      />
    </div>

    <!-- Description -->
    <p v-if="description" class="mt-1 text-sm text-gray-500">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
const modelValue = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{
  placeholder?: string
  type?: string
  actionLabel: string
  actionColor?: 'primary' | 'error' | 'warning' | 'success' | 'secondary'
  actionVariant?: 'solid' | 'outline' | 'ghost'
  actionIcon?: string
  loading?: boolean
  disabled?: boolean
  requireConfirm?: boolean
  confirmLabel?: string
  description?: string
}>(), {
  type: 'text',
  actionColor: 'primary',
  actionVariant: 'solid',
  loading: false,
  disabled: false,
  requireConfirm: false,
})

const emit = defineEmits<{
  (e: 'action', value: string): void
}>()

const isConfirmed = ref(false)

function handleAction() {
  if (props.requireConfirm && !isConfirmed.value) return
  emit('action', modelValue.value)
}

// Reset confirmation when value changes
watch(modelValue, () => {
  isConfirmed.value = false
})
</script>

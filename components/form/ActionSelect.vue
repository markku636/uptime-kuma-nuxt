<template>
  <div class="action-select" :class="{ 'opacity-50': disabled }">
    <div class="flex items-center gap-2">
      <div class="flex-1">
        <USelect
          v-model="modelValue"
          :items="items"
          :value-key="valueKey"
          :label-key="labelKey"
          :placeholder="placeholder"
          :disabled="disabled || loading"
          v-bind="$attrs"
        />
      </div>
      
      <UButton
        :color="actionColor"
        :variant="actionVariant"
        :icon="actionIcon"
        :loading="loading"
        :disabled="disabled || !modelValue || (requireConfirm && !isConfirmed)"
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
const modelValue = defineModel<string | number | null>({ default: null })

const props = withDefaults(defineProps<{
  items: Array<Record<string, any>>
  valueKey?: string
  labelKey?: string
  placeholder?: string
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
  valueKey: 'value',
  labelKey: 'label',
  actionColor: 'primary',
  actionVariant: 'solid',
  loading: false,
  disabled: false,
  requireConfirm: false,
})

const emit = defineEmits<{
  (e: 'action', value: string | number | null): void
}>()

const isConfirmed = ref(false)

function handleAction() {
  if (!modelValue.value) return
  if (props.requireConfirm && !isConfirmed.value) return
  emit('action', modelValue.value)
}

// Reset confirmation when value changes
watch(modelValue, () => {
  isConfirmed.value = false
})
</script>

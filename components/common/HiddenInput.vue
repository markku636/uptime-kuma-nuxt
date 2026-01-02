<template>
  <div class="relative">
    <UInput
      :model-value="displayValue"
      :type="revealed ? 'text' : 'password'"
      :placeholder="placeholder"
      :readonly="readonly"
      class="w-full pr-10"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex items-center pr-3"
      @click="revealed = !revealed"
    >
      <UIcon 
        :name="revealed ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" 
        class="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string
  placeholder?: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  readonly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const revealed = ref(false)

const displayValue = computed(() => {
  if (revealed.value) {
    return props.modelValue
  }
  return props.modelValue
})
</script>

<script setup lang="ts">
interface Props {
  value: string
  label?: string
  masked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  masked: false
})

const toast = useToast()
const showValue = ref(!props.masked)
const copied = ref(false)

const displayValue = computed(() => {
  if (props.masked && !showValue.value) {
    return '•'.repeat(Math.min(props.value.length, 32))
  }
  return props.value
})

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    toast.add({
      title: 'Copied!',
      description: 'Value copied to clipboard',
      color: 'green',
      icon: 'i-heroicons-check'
    })
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    toast.add({
      title: 'Failed to copy',
      description: 'Could not copy to clipboard',
      color: 'red',
      icon: 'i-heroicons-x-mark'
    })
  }
}
</script>

<template>
  <div class="space-y-1">
    <label v-if="label" class="text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>
    <div class="flex items-center gap-2">
      <div class="flex-1 relative">
        <input
          type="text"
          :value="displayValue"
          readonly
          class="w-full px-3 py-2 pr-20 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono text-gray-900 dark:text-gray-100"
        />
        <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <UButton
            v-if="masked"
            variant="ghost"
            size="xs"
            :icon="showValue ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
            @click="showValue = !showValue"
          />
          <UButton
            variant="ghost"
            size="xs"
            :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
            :class="copied && 'text-green-500'"
            @click="copyToClipboard"
          />
        </div>
      </div>
    </div>
  </div>
</template>

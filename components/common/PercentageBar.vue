<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600 dark:text-gray-400">{{ label }}</span>
      <span class="text-sm font-medium">{{ displayValue }}%</span>
    </div>
    <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div 
        class="h-full transition-all duration-300 rounded-full"
        :class="barColorClass"
        :style="{ width: `${clampedValue}%` }"
      />
    </div>
    <div v-if="showRange" class="flex justify-between text-xs text-gray-500">
      <span>{{ min }}%</span>
      <span>{{ max }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  value: number
  label?: string
  min?: number
  max?: number
  showRange?: boolean
  colorMode?: 'auto' | 'success' | 'warning' | 'danger' | 'primary'
  thresholds?: {
    warning: number
    danger: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Progress',
  min: 0,
  max: 100,
  showRange: false,
  colorMode: 'auto',
  thresholds: () => ({ warning: 80, danger: 95 })
})

const clampedValue = computed(() => {
  return Math.min(Math.max(props.value, props.min), props.max)
})

const displayValue = computed(() => {
  return clampedValue.value.toFixed(1)
})

const barColorClass = computed(() => {
  if (props.colorMode !== 'auto') {
    const colors = {
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      danger: 'bg-red-500',
      primary: 'bg-primary-500'
    }
    return colors[props.colorMode]
  }

  // Auto mode - color based on thresholds
  if (clampedValue.value >= props.thresholds.danger) {
    return 'bg-red-500'
  } else if (clampedValue.value >= props.thresholds.warning) {
    return 'bg-yellow-500'
  }
  return 'bg-green-500'
})
</script>

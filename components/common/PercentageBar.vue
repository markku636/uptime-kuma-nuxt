<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-sm text-toned">{{ label }}</span>
      <span class="text-sm font-medium">{{ displayValue }}%</span>
    </div>
    <div class="w-full h-2 bg-accented rounded-full overflow-hidden">
      <div 
        class="h-full transition-all duration-300 rounded-full"
        :class="barColorClass"
        :style="{ width: `${clampedValue}%` }"
      />
    </div>
    <div v-if="showRange" class="flex justify-between text-xs text-muted">
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
      success: 'bg-up',
      warning: 'bg-pending',
      danger: 'bg-down',
      primary: 'bg-primary'
    }
    return colors[props.colorMode]
  }

  // Auto mode - color based on thresholds
  if (clampedValue.value >= props.thresholds.danger) {
    return 'bg-down'
  } else if (clampedValue.value >= props.thresholds.warning) {
    return 'bg-pending'
  }
  return 'bg-up'
})
</script>

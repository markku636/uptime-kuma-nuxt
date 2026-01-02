<script setup lang="ts">
interface Props {
  value: number // 0-100 percentage
  duration?: string // e.g., "24h", "7d", "30d"
  precision?: number
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  duration: '24h',
  precision: 2,
  showLabel: true
})

const formattedValue = computed(() => {
  return props.value.toFixed(props.precision)
})

const colorClass = computed(() => {
  if (props.value >= 99) return 'text-green-600 dark:text-green-400'
  if (props.value >= 95) return 'text-yellow-600 dark:text-yellow-400'
  if (props.value >= 90) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
})

const bgColorClass = computed(() => {
  if (props.value >= 99) return 'bg-green-500'
  if (props.value >= 95) return 'bg-yellow-500'
  if (props.value >= 90) return 'bg-orange-500'
  return 'bg-red-500'
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between">
      <span :class="['text-lg font-bold tabular-nums', colorClass]">
        {{ formattedValue }}%
      </span>
      <span v-if="showLabel" class="text-xs text-gray-500 dark:text-gray-400">
        {{ duration }}
      </span>
    </div>
    <div class="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        :class="['h-full rounded-full transition-all duration-300', bgColorClass]"
        :style="{ width: `${Math.min(value, 100)}%` }"
      />
    </div>
  </div>
</template>

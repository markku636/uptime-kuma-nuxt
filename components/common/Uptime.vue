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
  if (props.value >= 99) return 'text-up-fg'
  if (props.value >= 95) return 'text-pending-fg'
  if (props.value >= 90) return 'text-orange-600 dark:text-orange-400'
  return 'text-down-fg'
})

const bgColorClass = computed(() => {
  if (props.value >= 99) return 'bg-up'
  if (props.value >= 95) return 'bg-pending'
  if (props.value >= 90) return 'bg-orange-500'
  return 'bg-down'
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between">
      <span :class="['text-lg font-bold tabular-nums', colorClass]">
        {{ formattedValue }}%
      </span>
      <span v-if="showLabel" class="text-xs text-muted">
        {{ duration }}
      </span>
    </div>
    <div class="h-1.5 w-full bg-accented rounded-full overflow-hidden">
      <div
        :class="['h-full rounded-full transition-all duration-300', bgColorClass]"
        :style="{ width: `${Math.min(value, 100)}%` }"
      />
    </div>
  </div>
</template>

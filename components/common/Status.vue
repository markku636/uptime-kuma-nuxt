<script setup lang="ts">
interface Props {
  status: 'up' | 'down' | 'pending' | 'maintenance' | 'unknown'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  pulse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  showLabel: true,
  pulse: false
})

const statusConfig = computed(() => {
  switch (props.status) {
    case 'up':
      return {
        label: 'Up',
        color: 'bg-green-500',
        ringColor: 'ring-green-500/30',
        textColor: 'text-green-600 dark:text-green-400'
      }
    case 'down':
      return {
        label: 'Down',
        color: 'bg-red-500',
        ringColor: 'ring-red-500/30',
        textColor: 'text-red-600 dark:text-red-400'
      }
    case 'pending':
      return {
        label: 'Pending',
        color: 'bg-yellow-500',
        ringColor: 'ring-yellow-500/30',
        textColor: 'text-yellow-600 dark:text-yellow-400'
      }
    case 'maintenance':
      return {
        label: 'Maintenance',
        color: 'bg-blue-500',
        ringColor: 'ring-blue-500/30',
        textColor: 'text-blue-600 dark:text-blue-400'
      }
    default:
      return {
        label: 'Unknown',
        color: 'bg-gray-400',
        ringColor: 'ring-gray-400/30',
        textColor: 'text-gray-600 dark:text-gray-400'
      }
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return { dot: 'w-2 h-2', text: 'text-xs' }
    case 'lg':
      return { dot: 'w-4 h-4', text: 'text-base' }
    default:
      return { dot: 'w-3 h-3', text: 'text-sm' }
  }
})
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span
      :class="[
        'rounded-full ring-2',
        statusConfig.color,
        statusConfig.ringColor,
        sizeClasses.dot,
        pulse && status === 'up' && 'animate-pulse'
      ]"
    />
    <span
      v-if="showLabel"
      :class="['font-medium', statusConfig.textColor, sizeClasses.text]"
    >
      {{ statusConfig.label }}
    </span>
  </span>
</template>

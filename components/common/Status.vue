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
        color: 'bg-up',
        ringColor: 'ring-up/30',
        textColor: 'text-up-fg'
      }
    case 'down':
      return {
        label: 'Down',
        color: 'bg-down',
        ringColor: 'ring-down/30',
        textColor: 'text-down-fg'
      }
    case 'pending':
      return {
        label: 'Pending',
        color: 'bg-pending',
        ringColor: 'ring-pending/30',
        textColor: 'text-pending-fg'
      }
    case 'maintenance':
      return {
        label: 'Maintenance',
        color: 'bg-maintenance',
        ringColor: 'ring-maintenance/30',
        textColor: 'text-maintenance-fg'
      }
    default:
      return {
        label: 'Unknown',
        color: 'bg-unknown',
        ringColor: 'ring-unknown/30',
        textColor: 'text-toned'
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

<template>
  <div 
    :class="[
      'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
      statusClass
    ]"
  >
    <span 
      :class="[
        'w-2 h-2 rounded-full',
        dotClass,
        pulse && status === 'up' ? 'animate-pulse' : ''
      ]"
    />
    <span>{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  status: 'up' | 'down' | 'pending' | 'maintenance' | 'unknown'
  pulse?: boolean
  showText?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  status: 'unknown',
  pulse: false,
  showText: true
})

const statusClass = computed(() => {
  const classes = {
    up: 'bg-up-subtle text-up-fg',
    down: 'bg-down-subtle text-down-fg',
    pending: 'bg-pending-subtle text-pending-fg',
    maintenance: 'bg-maintenance-subtle text-maintenance-fg',
    unknown: 'bg-elevated text-default'
  }
  return classes[props.status]
})

const dotClass = computed(() => {
  const classes = {
    up: 'bg-up',
    down: 'bg-down',
    pending: 'bg-pending',
    maintenance: 'bg-maintenance',
    unknown: 'bg-unknown'
  }
  return classes[props.status]
})

const statusText = computed(() => {
  const texts = {
    up: 'Operational',
    down: 'Down',
    pending: 'Pending',
    maintenance: 'Maintenance',
    unknown: 'Unknown'
  }
  return texts[props.status]
})
</script>

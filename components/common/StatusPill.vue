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
    up: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    down: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    maintenance: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    unknown: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
  }
  return classes[props.status]
})

const dotClass = computed(() => {
  const classes = {
    up: 'bg-green-500',
    down: 'bg-red-500',
    pending: 'bg-yellow-500',
    maintenance: 'bg-blue-500',
    unknown: 'bg-gray-500'
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

<template>
  <span 
    :class="[
      'inline-flex items-center justify-center font-medium',
      sizeClass,
      colorClass
    ]"
  >
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
interface Props {
  text?: string
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  color: 'gray',
  size: 'md'
})

const sizeClass = computed(() => {
  const sizes = {
    xs: 'text-xs px-1.5 py-0.5 rounded',
    sm: 'text-sm px-2 py-0.5 rounded',
    md: 'text-sm px-2.5 py-1 rounded-md',
    lg: 'text-base px-3 py-1.5 rounded-md',
    xl: 'text-lg px-4 py-2 rounded-lg'
  }
  return sizes[props.size]
})

const colorClass = computed(() => {
  const colors = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    success: 'bg-up-subtle text-up-fg',
    warning: 'bg-pending-subtle text-pending-fg',
    danger: 'bg-down-subtle text-down-fg',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    gray: 'bg-elevated text-default'
  }
  return colors[props.color]
})
</script>

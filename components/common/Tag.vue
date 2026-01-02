<script setup lang="ts">
interface Props {
  name: string
  color?: string
  value?: string | null
  clickable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  color: '#6366f1',
  value: null,
  clickable: false,
  size: 'md'
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

// Compute text color based on background color brightness
const textColor = computed(() => {
  const hex = props.color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? '#000000' : '#ffffff'
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'text-xs px-1.5 py-0.5'
    case 'lg':
      return 'text-base px-3 py-1.5'
    default:
      return 'text-sm px-2 py-1'
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center rounded-full font-medium transition-opacity',
      sizeClasses,
      clickable && 'cursor-pointer hover:opacity-80'
    ]"
    :style="{
      backgroundColor: color,
      color: textColor
    }"
    @click="clickable && emit('click')"
  >
    <span>{{ name }}</span>
    <span v-if="value" class="ml-1 opacity-75">: {{ value }}</span>
  </span>
</template>

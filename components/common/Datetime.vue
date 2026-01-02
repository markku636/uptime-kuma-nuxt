<script setup lang="ts">
interface Props {
  date: string | Date
  format?: 'relative' | 'absolute' | 'both'
  showTime?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  format: 'both',
  showTime: true
})

const dateObj = computed(() => {
  return typeof props.date === 'string' ? new Date(props.date) : props.date
})

const absoluteFormat = computed(() => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
  
  if (props.showTime) {
    options.hour = '2-digit'
    options.minute = '2-digit'
  }
  
  return dateObj.value.toLocaleDateString(undefined, options)
})

const relativeFormat = computed(() => {
  const now = new Date()
  const diff = now.getTime() - dateObj.value.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  if (months < 12) return `${months}mo ago`
  return `${years}y ago`
})
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
    <template v-if="format === 'relative'">
      <span :title="absoluteFormat">{{ relativeFormat }}</span>
    </template>
    <template v-else-if="format === 'absolute'">
      <span>{{ absoluteFormat }}</span>
    </template>
    <template v-else>
      <span>{{ absoluteFormat }}</span>
      <span class="text-gray-400 dark:text-gray-500">({{ relativeFormat }})</span>
    </template>
  </span>
</template>

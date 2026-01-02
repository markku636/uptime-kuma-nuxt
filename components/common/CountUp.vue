<template>
  <span ref="el" class="tabular-nums">{{ displayValue }}</span>
</template>

<script setup lang="ts">
interface Props {
  endVal: number
  startVal?: number
  duration?: number
  decimals?: number
  separator?: string
  prefix?: string
  suffix?: string
  autoplay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  startVal: 0,
  duration: 2000,
  decimals: 0,
  separator: ',',
  prefix: '',
  suffix: '',
  autoplay: true
})

const el = ref<HTMLElement | null>(null)
const currentValue = ref(props.startVal)
const displayValue = computed(() => {
  const formatted = formatNumber(currentValue.value)
  return `${props.prefix}${formatted}${props.suffix}`
})

function formatNumber(num: number): string {
  const fixed = num.toFixed(props.decimals)
  const parts = fixed.split('.')
  
  // Add thousand separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, props.separator)
  
  return parts.join('.')
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function animate() {
  const startTime = performance.now()
  const startValue = props.startVal
  const endValue = props.endVal
  const duration = props.duration

  function tick(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easedProgress = easeOutQuart(progress)
    
    currentValue.value = startValue + (endValue - startValue) * easedProgress

    if (progress < 1) {
      requestAnimationFrame(tick)
    } else {
      currentValue.value = endValue
    }
  }

  requestAnimationFrame(tick)
}

// Start animation on mount
onMounted(() => {
  if (props.autoplay) {
    animate()
  }
})

// Watch for changes in endVal
watch(() => props.endVal, () => {
  animate()
})

// Expose methods
defineExpose({
  start: animate,
  reset: () => {
    currentValue.value = props.startVal
  }
})
</script>

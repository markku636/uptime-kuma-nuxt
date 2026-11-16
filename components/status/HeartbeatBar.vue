<template>
  <div ref="wrapRef" class="heartbeat-bar-wrap" :style="wrapStyle">
    <div class="heartbeat-bar" :style="barStyle">
      <div
        v-for="(beat, index) in displayBeats"
        :key="index"
        class="beat-hover-area"
        :class="{ empty: beat === 0 }"
        :style="beatHoverAreaStyle"
        :title="getBeatTitle(beat)"
      >
        <div
          class="beat"
          :class="getBeatClass(beat)"
          :style="beatStyle"
        />
      </div>
    </div>
    
    <!-- Time indicators (only for mid/big size) -->
    <div
      v-if="showTimeIndicators && displayBeats.length > 4"
      class="time-indicators"
      :style="timeStyle"
    >
      <span>{{ timeSinceFirstBeat }}</span>
      <div v-if="showConnectingLine" class="connecting-line" />
      <span>{{ timeSinceLastBeat }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

interface Heartbeat {
  status: number
  time: string
  ping?: number
  msg?: string
}

type SizeType = 'small' | 'mid' | 'big'

const props = withDefaults(defineProps<{
  monitorId?: number
  heartbeats?: Heartbeat[]
  size?: SizeType
  showTimeIndicators?: boolean
  showConnectingLine?: boolean
}>(), {
  size: 'mid',
  showTimeIndicators: false,
  showConnectingLine: true
})

// Size configurations
const sizeConfig = computed(() => {
  switch (props.size) {
    case 'small':
      return { beatWidth: 3, beatHeight: 10, hoverAreaPadding: 1, hoverScale: 1.3 }
    case 'big':
      return { beatWidth: 10, beatHeight: 30, hoverAreaPadding: 4, hoverScale: 1.5 }
    case 'mid':
    default:
      return { beatWidth: 5, beatHeight: 16, hoverAreaPadding: 2, hoverScale: 1.4 }
  }
})

// Refs
const wrapRef = ref<HTMLElement | null>(null)
const maxBeats = ref(50)
const isAnimating = ref(false)

// Computed
const beatList = computed(() => {
  return props.heartbeats || []
})

// Calculate number of padding beats needed
const numPadding = computed(() => {
  const beatCount = beatList.value.length
  const diff = maxBeats.value - beatCount
  return Math.max(0, diff)
})

// Display beats with padding
const displayBeats = computed(() => {
  const placeholders = Array(numPadding.value).fill(0)
  const recentBeats = beatList.value.slice(-maxBeats.value)
  return [...placeholders, ...recentBeats]
})

// Styles
const wrapStyle = computed(() => {
  const { beatHeight, hoverScale } = sizeConfig.value
  const topBottom = ((beatHeight * hoverScale) - beatHeight) / 2
  const leftRight = ((sizeConfig.value.beatWidth * hoverScale) - sizeConfig.value.beatWidth) / 2
  
  return {
    padding: `${topBottom}px ${leftRight}px`,
    width: '100%'
  }
})

const barStyle = computed(() => {
  if (isAnimating.value && displayBeats.value.length > maxBeats.value) {
    const { beatWidth, hoverAreaPadding } = sizeConfig.value
    const width = -(beatWidth + hoverAreaPadding * 2)
    return {
      transition: 'all ease-in-out 0.25s',
      transform: `translateX(${width}px)`
    }
  }
  return {
    transform: 'translateX(0)'
  }
})

const beatHoverAreaStyle = computed(() => ({
  padding: `${sizeConfig.value.hoverAreaPadding}px`,
  '--hover-scale': sizeConfig.value.hoverScale
}))

const beatStyle = computed(() => ({
  width: `${sizeConfig.value.beatWidth}px`,
  height: `${sizeConfig.value.beatHeight}px`
}))

const timeStyle = computed(() => ({
  marginLeft: `${numPadding.value * (sizeConfig.value.beatWidth + sizeConfig.value.hoverAreaPadding * 2)}px`
}))

// Time calculations
const timeSinceFirstBeat = computed(() => {
  const firstBeat = displayBeats.value.find(b => b !== 0) as Heartbeat | undefined
  if (!firstBeat?.time) return ''
  
  const minutes = dayjs().diff(dayjs.utc(firstBeat.time), 'minutes')
  if (minutes > 60) {
    return `${Math.floor(minutes / 60)}h`
  }
  return `${minutes}m`
})

const timeSinceLastBeat = computed(() => {
  const lastBeat = displayBeats.value[displayBeats.value.length - 1] as Heartbeat | undefined
  if (!lastBeat?.time) return ''
  
  const seconds = dayjs().diff(dayjs.utc(lastBeat.time), 'seconds')
  
  if (seconds < 120) {
    return 'now'
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`
  } else {
    return `${Math.floor(seconds / 3600)}h ago`
  }
})

// Methods
function getBeatClass(beat: Heartbeat | 0) {
  if (beat === 0) return 'empty'
  
  switch (beat.status) {
    case 0: return 'down'
    case 1: return 'up'
    case 2: return 'pending'
    case 3: return 'maintenance'
    default: return 'empty'
  }
}

function getBeatTitle(beat: Heartbeat | 0) {
  if (beat === 0) return 'No data'
  
  let title = beat.time ? dayjs(beat.time).format('YYYY-MM-DD HH:mm:ss') : ''
  if (beat.ping !== null && beat.ping !== undefined) {
    title += ` | ${beat.ping}ms`
  }
  if (beat.msg) {
    title += ` - ${beat.msg}`
  }
  return title
}

// Watch for new heartbeats to trigger animation
watch(beatList, (newVal, oldVal) => {
  if (newVal.length > oldVal?.length) {
    isAnimating.value = true
    setTimeout(() => {
      isAnimating.value = false
    }, 300)
  }
}, { deep: true })

// Calculate max beats based on container width
function resize() {
  if (wrapRef.value) {
    const { beatWidth, hoverAreaPadding } = sizeConfig.value
    maxBeats.value = Math.floor(wrapRef.value.clientWidth / (beatWidth + hoverAreaPadding * 2))
  }
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
.heartbeat-bar-wrap {
  overflow: hidden;
  width: 100%;
  white-space: nowrap;
}

.heartbeat-bar {
  display: flex;
  align-items: center;
}

.beat-hover-area {
  display: inline-block;
  cursor: pointer;
}

.beat-hover-area:not(.empty):hover {
  transition: all ease-in-out 0.15s;
  opacity: 0.8;
  transform: scale(var(--hover-scale));
}

.beat {
  border-radius: 2px;
  pointer-events: none;
}

.beat.up {
  background-color: var(--uk-status-up);
}

.beat.down {
  background-color: var(--uk-status-down);
}

.beat.pending {
  background-color: var(--uk-status-pending);
}

.beat.maintenance {
  background-color: var(--uk-status-maintenance);
}

.beat.empty {
  background-color: var(--uk-bg-active);
}

.time-indicators {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--uk-text-muted);
  margin-top: 4px;
}

.connecting-line {
  flex-grow: 1;
  height: 1px;
  background-color: var(--uk-bg-active);
  margin: 0 10px;
}
</style>

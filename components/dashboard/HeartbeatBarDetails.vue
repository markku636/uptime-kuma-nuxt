<template>
  <div class="heartbeat-bar">
    <div
      v-for="(beat, index) in displayedBeats"
      :key="index"
      class="beat"
      :class="getStatusClass(beat)"
      :title="getTooltip(beat)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

interface Heartbeat {
  time: string
  status: number
  ping?: number
  msg?: string
}

const props = defineProps<{
  heartbeats: Heartbeat[]
  maxBeats?: number
}>()

const maxBeats = computed(() => props.maxBeats || 100)

const displayedBeats = computed(() => {
  const beats = [...props.heartbeats].reverse()
  if (beats.length > maxBeats.value) {
    return beats.slice(beats.length - maxBeats.value)
  }
  // Pad with empty beats if not enough
  const padding = Array(maxBeats.value - beats.length).fill({ status: -1 })
  return [...padding, ...beats]
})

const getStatusClass = (beat: Heartbeat) => {
  if (beat.status === -1) return 'empty'
  if (beat.status === 1) return 'up'
  if (beat.status === 0) return 'down'
  if (beat.status === 2) return 'pending'
  if (beat.status === 3) return 'maintenance'
  return 'unknown'
}

const getTooltip = (beat: Heartbeat) => {
  if (beat.status === -1) return ''
  const time = dayjs(beat.time).format('YYYY-MM-DD HH:mm:ss')
  const status = beat.status === 1 ? 'Up' : beat.status === 0 ? 'Down' : beat.status === 3 ? 'Maintenance' : 'Pending'
  const ping = beat.ping ? `${beat.ping}ms` : ''
  return `${time} - ${status}${ping ? ` (${ping})` : ''}`
}
</script>

<style scoped>
.heartbeat-bar {
  display: flex;
  gap: 2px;
  height: 30px;
  width: 100%;
  margin-bottom: 8px;
}

.beat {
  flex: 1;
  min-width: 3px;
  max-width: 8px;
  border-radius: 3px;
  transition: transform 0.15s ease;
}

.beat:hover {
  transform: scaleY(1.2);
}

.beat.empty {
  background: #e9ecef;
}

.dark .beat.empty {
  background: #30363d;
}

.beat.up {
  background: #28a745;
}

.beat.down {
  background: #dc3545;
}

.beat.pending {
  background: #ffc107;
}

.beat.maintenance {
  background: #1e90ff;
}

.beat.unknown {
  background: #6c757d;
}
</style>

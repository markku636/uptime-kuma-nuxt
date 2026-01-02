<template>
  <div class="heartbeat-bar">
    <div
      v-for="(beat, index) in displayedHeartbeats"
      :key="index"
      class="beat"
      :class="statusClass(beat.status)"
      :title="`${formatTime(beat.time)} - ${statusText(beat.status)}`"
    />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  heartbeats: any[]
  maxBeats?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxBeats: 50
})

const displayedHeartbeats = computed(() => {
  const beats = props.heartbeats.slice(0, props.maxBeats)
  // Reverse so oldest is on left, newest on right
  return [...beats].reverse()
})

const statusClass = (status: number) => {
  switch (status) {
    case 1: return 'up'
    case 0: return 'down'
    case 2: return 'pending'
    case 3: return 'maintenance'
    default: return 'unknown'
  }
}

const statusText = (status: number) => {
  switch (status) {
    case 1: return 'Up'
    case 0: return 'Down'
    case 2: return 'Pending'
    case 3: return 'Maintenance'
    default: return 'Unknown'
  }
}

const formatTime = (time: string) => {
  return dayjs(time).format('MM-DD HH:mm')
}
</script>

<style scoped>
.heartbeat-bar {
  display: flex;
  gap: 2px;
  height: 24px;
  align-items: center;
}

.beat {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  transition: height 0.15s;
}

.beat:hover {
  height: 20px;
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

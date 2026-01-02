<template>
  <div class="flex items-center space-x-0.5">
    <div
      v-for="(heartbeat, index) in displayHeartbeats"
      :key="index"
      class="w-1.5 h-6 rounded-sm"
      :class="getHeartbeatColor(heartbeat)"
      :title="getHeartbeatTooltip(heartbeat)"
    />
  </div>
</template>

<script setup lang="ts">
interface Heartbeat {
  status: number
  time: string
  ping?: number
  msg?: string
}

interface Props {
  heartbeats: Heartbeat[]
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 30
})

const displayHeartbeats = computed(() => {
  // Pad with empty heartbeats if not enough
  const heartbeats = [...props.heartbeats]
  while (heartbeats.length < props.count) {
    heartbeats.push({ status: -1, time: '' })
  }
  return heartbeats.slice(0, props.count).reverse()
})

const getHeartbeatColor = (heartbeat: Heartbeat) => {
  switch (heartbeat.status) {
    case 1: return 'bg-green-500'
    case 0: return 'bg-red-500'
    case 2: return 'bg-yellow-500'
    case 3: return 'bg-blue-500'
    default: return 'bg-gray-200 dark:bg-gray-700'
  }
}

const getHeartbeatTooltip = (heartbeat: Heartbeat) => {
  if (heartbeat.status === -1) return 'No data'
  
  const status = ['Down', 'Up', 'Pending', 'Maintenance'][heartbeat.status] || 'Unknown'
  const time = heartbeat.time ? new Date(heartbeat.time).toLocaleString() : ''
  const ping = heartbeat.ping ? `${heartbeat.ping}ms` : ''
  
  return `${status}${ping ? ` - ${ping}` : ''}${time ? `\n${time}` : ''}`
}
</script>

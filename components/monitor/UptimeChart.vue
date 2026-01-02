<script setup lang="ts">
import type { Heartbeat } from '~/types'

interface Props {
  heartbeats: Heartbeat[]
  height?: number
  showLabels?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 200,
  showLabels: true
})

// Process data for chart
const chartData = computed(() => {
  if (props.heartbeats.length === 0) return []
  
  // Group heartbeats by hour for the last 24 hours
  const now = new Date()
  const hourlyData: Record<string, { up: number; down: number; total: number; avgPing: number }> = {}
  
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
    const key = hour.toISOString().slice(0, 13)
    hourlyData[key] = { up: 0, down: 0, total: 0, avgPing: 0 }
  }
  
  // Fill in actual data
  for (const beat of props.heartbeats) {
    const key = new Date(beat.time).toISOString().slice(0, 13)
    if (hourlyData[key]) {
      hourlyData[key].total++
      if (beat.status === 1) {
        hourlyData[key].up++
        hourlyData[key].avgPing += beat.ping || 0
      } else {
        hourlyData[key].down++
      }
    }
  }
  
  // Calculate averages and uptime percentage
  return Object.entries(hourlyData).map(([key, data]) => ({
    time: key,
    label: new Date(key).toLocaleTimeString('en-US', { hour: '2-digit' }),
    uptime: data.total > 0 ? Math.round((data.up / data.total) * 100) : 100,
    avgPing: data.up > 0 ? Math.round(data.avgPing / data.up) : 0,
    hasData: data.total > 0
  }))
})

// Calculate max ping for scaling
const maxPing = computed(() => {
  const pings = chartData.value.map(d => d.avgPing).filter(p => p > 0)
  return pings.length > 0 ? Math.max(...pings) : 100
})

// Get bar height percentage
function getBarHeight(ping: number): number {
  if (ping === 0) return 5
  return Math.max(5, (ping / maxPing.value) * 100)
}

// Get bar color based on uptime
function getBarColor(uptime: number, hasData: boolean): string {
  if (!hasData) return 'bg-gray-200 dark:bg-gray-700'
  if (uptime === 100) return 'bg-green-500'
  if (uptime >= 99) return 'bg-green-400'
  if (uptime >= 95) return 'bg-yellow-500'
  return 'bg-red-500'
}
</script>

<template>
  <div class="w-full">
    <!-- Chart Area -->
    <div
      class="relative flex items-end gap-0.5"
      :style="{ height: `${height}px` }"
    >
      <!-- Y-axis labels -->
      <div
        v-if="showLabels"
        class="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500 pr-2"
      >
        <span>{{ maxPing }}ms</span>
        <span>{{ Math.round(maxPing / 2) }}ms</span>
        <span>0ms</span>
      </div>
      
      <!-- Bars -->
      <div
        class="flex-1 flex items-end gap-0.5"
        :class="{ 'ml-14': showLabels }"
      >
        <div
          v-for="(data, index) in chartData"
          :key="index"
          class="flex-1 flex flex-col items-center group relative"
        >
          <!-- Bar -->
          <div
            :class="[
              'w-full rounded-t transition-all',
              getBarColor(data.uptime, data.hasData)
            ]"
            :style="{ height: `${getBarHeight(data.avgPing)}%` }"
          ></div>
          
          <!-- Tooltip -->
          <div
            class="absolute bottom-full mb-2 hidden group-hover:block z-10"
          >
            <div class="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
              <p class="font-medium">{{ data.label }}</p>
              <p>Uptime: {{ data.uptime }}%</p>
              <p v-if="data.avgPing > 0">Avg Ping: {{ data.avgPing }}ms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- X-axis labels -->
    <div
      v-if="showLabels"
      class="flex justify-between text-xs text-gray-500 mt-2"
      :class="{ 'ml-14': showLabels }"
    >
      <span>24h ago</span>
      <span>12h ago</span>
      <span>Now</span>
    </div>
  </div>
</template>

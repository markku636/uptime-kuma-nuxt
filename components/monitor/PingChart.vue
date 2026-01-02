<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface HeartbeatData {
  time: string
  ping: number | null
  status: number
}

interface Props {
  data: HeartbeatData[]
  height?: number
  showLegend?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 200,
  showLegend: false
})

const colorMode = useColorMode()

const chartData = computed(() => {
  const labels = props.data.map(d => {
    const date = new Date(d.time)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
  
  const pingData = props.data.map(d => d.ping)
  
  return {
    labels,
    datasets: [
      {
        label: 'Response Time (ms)',
        data: pingData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const
  },
  plugins: {
    legend: {
      display: props.showLegend,
      labels: {
        color: colorMode.value === 'dark' ? '#9ca3af' : '#4b5563'
      }
    },
    tooltip: {
      backgroundColor: colorMode.value === 'dark' ? '#1f2937' : '#ffffff',
      titleColor: colorMode.value === 'dark' ? '#f3f4f6' : '#111827',
      bodyColor: colorMode.value === 'dark' ? '#d1d5db' : '#374151',
      borderColor: colorMode.value === 'dark' ? '#374151' : '#e5e7eb',
      borderWidth: 1,
      callbacks: {
        label: (context: any) => {
          const value = context.raw
          return value !== null ? `${value} ms` : 'N/A'
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: colorMode.value === 'dark' ? '#374151' : '#e5e7eb',
        drawBorder: false
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9ca3af' : '#4b5563',
        maxTicksLimit: 8
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: colorMode.value === 'dark' ? '#374151' : '#e5e7eb',
        drawBorder: false
      },
      ticks: {
        color: colorMode.value === 'dark' ? '#9ca3af' : '#4b5563',
        callback: (value: any) => `${value} ms`
      }
    }
  }
}))
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Line
      v-if="data.length > 0"
      :data="chartData"
      :options="chartOptions"
    />
    <div
      v-else
      class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400"
    >
      No data available
    </div>
  </div>
</template>

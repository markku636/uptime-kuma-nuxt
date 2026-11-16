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

// Canvas needs concrete colours; resolve them from tokens
const tokens = useCssTokens({
  line: '--uk-status-up',
  grid: '--uk-border',
  axis: '--uk-text-muted',
  tooltipBg: '--uk-bg-raised',
  tooltipTitle: '--uk-text',
  tooltipBody: '--uk-text-secondary',
  tooltipBorder: '--uk-border-strong',
})

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
        borderColor: tokens.value.line || '#5cdd8b',
        backgroundColor: withAlpha(tokens.value.line || '#5cdd8b', 0.12),
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
        color: tokens.value.axis
      }
    },
    tooltip: {
      backgroundColor: tokens.value.tooltipBg,
      titleColor: tokens.value.tooltipTitle,
      bodyColor: tokens.value.tooltipBody,
      borderColor: tokens.value.tooltipBorder,
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
        color: tokens.value.grid,
        drawBorder: false
      },
      ticks: {
        color: tokens.value.axis,
        maxTicksLimit: 8
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: tokens.value.grid,
        drawBorder: false
      },
      ticks: {
        color: tokens.value.axis,
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
      class="flex items-center justify-center h-full text-muted"
    >
      No data available
    </div>
  </div>
</template>

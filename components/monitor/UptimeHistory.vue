<template>
  <div class="uptime-history">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-medium text-gray-900 dark:text-gray-100">
        {{ $t('Uptime History') }}
      </h3>
      <USelect
        v-model="selectedRange"
        :items="rangeOptions"
        value-key="value"
        label-key="label"
        size="sm"
        class="w-32"
      />
    </div>

    <!-- Days Grid -->
    <div class="grid grid-cols-7 gap-1 sm:gap-2">
      <!-- Day Labels -->
      <div
        v-for="day in dayLabels"
        :key="day"
        class="text-center text-xs text-gray-500 pb-1"
      >
        {{ day }}
      </div>

      <!-- Calendar Days -->
      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="aspect-square rounded-sm flex items-center justify-center text-xs"
        :class="getDayClass(day)"
        :title="getDayTitle(day)"
      >
        <span v-if="showDayNumbers" class="opacity-50">
          {{ day.date?.getDate() }}
        </span>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center justify-center gap-4 mt-4 text-xs">
      <div class="flex items-center gap-1">
        <div class="w-3 h-3 rounded-sm bg-green-500" />
        <span>{{ $t('No downtime') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-3 h-3 rounded-sm bg-yellow-500" />
        <span>{{ $t('Some downtime') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-3 h-3 rounded-sm bg-red-500" />
        <span>{{ $t('Major downtime') }}</span>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="showSummary" class="mt-4 grid grid-cols-3 gap-4 text-center">
      <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
        <p class="text-lg font-bold text-green-500">{{ summary.uptimeDays }}</p>
        <p class="text-xs text-gray-500">{{ $t('Days 100%') }}</p>
      </div>
      <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
        <p class="text-lg font-bold text-yellow-500">{{ summary.partialDays }}</p>
        <p class="text-xs text-gray-500">{{ $t('Partial Days') }}</p>
      </div>
      <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
        <p class="text-lg font-bold text-red-500">{{ summary.downtimeDays }}</p>
        <p class="text-xs text-gray-500">{{ $t('Outage Days') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface DayData {
  date: Date | null
  uptime?: number // 0-100
  incidents?: number
  isEmpty?: boolean
}

interface DailyUptime {
  date: string
  uptime: number
  incidents?: number
}

const props = withDefaults(defineProps<{
  data?: DailyUptime[]
  defaultRange?: number
  showDayNumbers?: boolean
  showSummary?: boolean
}>(), {
  defaultRange: 30,
  showDayNumbers: false,
  showSummary: true,
})

const { t } = useI18n()

const selectedRange = ref(props.defaultRange)

const rangeOptions = [
  { value: 7, label: t('7 days') },
  { value: 30, label: t('30 days') },
  { value: 60, label: t('60 days') },
  { value: 90, label: t('90 days') },
]

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Generate calendar days based on selected range
const calendarDays = computed<DayData[]>(() => {
  const days: DayData[] = []
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - selectedRange.value + 1)
  
  // Pad with empty days to start on Sunday
  const startDay = startDate.getDay()
  for (let i = 0; i < startDay; i++) {
    days.push({ date: null, isEmpty: true })
  }
  
  // Add actual days
  for (let i = 0; i < selectedRange.value; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    
    // Find data for this day
    const dayStr = date.toISOString().split('T')[0]
    const dayData = props.data?.find(d => d.date === dayStr)
    
    days.push({
      date,
      uptime: dayData?.uptime,
      incidents: dayData?.incidents,
    })
  }
  
  return days
})

// Calculate summary
const summary = computed(() => {
  const validDays = calendarDays.value.filter(d => d.date && d.uptime !== undefined)
  
  return {
    uptimeDays: validDays.filter(d => d.uptime === 100).length,
    partialDays: validDays.filter(d => d.uptime !== undefined && d.uptime > 0 && d.uptime < 100).length,
    downtimeDays: validDays.filter(d => d.uptime === 0).length,
  }
})

function getDayClass(day: DayData): string {
  if (day.isEmpty || !day.date) {
    return 'bg-transparent'
  }
  
  if (day.uptime === undefined) {
    return 'bg-gray-200 dark:bg-gray-700'
  }
  
  if (day.uptime === 100) {
    return 'bg-green-500 text-white'
  } else if (day.uptime >= 90) {
    return 'bg-green-400 text-white'
  } else if (day.uptime >= 75) {
    return 'bg-yellow-400 text-white'
  } else if (day.uptime >= 50) {
    return 'bg-orange-500 text-white'
  } else if (day.uptime > 0) {
    return 'bg-red-400 text-white'
  } else {
    return 'bg-red-600 text-white'
  }
}

function getDayTitle(day: DayData): string {
  if (!day.date) return ''
  
  const dateStr = day.date.toLocaleDateString()
  
  if (day.uptime === undefined) {
    return `${dateStr}: No data`
  }
  
  let title = `${dateStr}: ${day.uptime.toFixed(2)}% uptime`
  
  if (day.incidents) {
    title += ` (${day.incidents} incident${day.incidents > 1 ? 's' : ''})`
  }
  
  return title
}
</script>

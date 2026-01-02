<template>
  <div class="overall-status p-4 rounded-lg" :class="statusStyles.bg">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div 
          class="w-10 h-10 rounded-full flex items-center justify-center"
          :class="statusStyles.icon"
        >
          <UIcon :name="statusIcon" class="w-6 h-6" />
        </div>
        <div>
          <h3 class="font-semibold text-lg" :class="statusStyles.text">
            {{ statusText }}
          </h3>
          <p v-if="subtitle" class="text-sm opacity-75" :class="statusStyles.text">
            {{ subtitle }}
          </p>
        </div>
      </div>
      
      <div v-if="showLastUpdated" class="text-right">
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('Last updated') }}</p>
        <p class="text-sm font-mono">{{ formattedLastUpdate }}</p>
      </div>
    </div>

    <!-- Optional details -->
    <div v-if="showDetails && stats" class="mt-4 grid grid-cols-3 gap-4">
      <div class="text-center">
        <p class="text-2xl font-bold text-green-500">{{ stats.up }}</p>
        <p class="text-xs text-gray-500">{{ $t('Operational') }}</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-yellow-500">{{ stats.degraded }}</p>
        <p class="text-xs text-gray-500">{{ $t('Degraded') }}</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-red-500">{{ stats.down }}</p>
        <p class="text-xs text-gray-500">{{ $t('Outage') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type OverallStatusType = 'operational' | 'degraded' | 'partial-outage' | 'major-outage' | 'maintenance' | 'unknown'

interface Stats {
  up: number
  degraded: number
  down: number
}

const props = withDefaults(defineProps<{
  status: OverallStatusType
  subtitle?: string
  showLastUpdated?: boolean
  lastUpdated?: Date | string
  showDetails?: boolean
  stats?: Stats
}>(), {
  status: 'unknown',
  showLastUpdated: true,
  showDetails: false,
})

const { t } = useI18n()

const statusText = computed(() => {
  switch (props.status) {
    case 'operational':
      return t('All Systems Operational')
    case 'degraded':
      return t('Degraded Performance')
    case 'partial-outage':
      return t('Partial System Outage')
    case 'major-outage':
      return t('Major System Outage')
    case 'maintenance':
      return t('Under Maintenance')
    default:
      return t('Status Unknown')
  }
})

const statusIcon = computed(() => {
  switch (props.status) {
    case 'operational':
      return 'i-heroicons-check-circle'
    case 'degraded':
      return 'i-heroicons-exclamation-circle'
    case 'partial-outage':
      return 'i-heroicons-exclamation-triangle'
    case 'major-outage':
      return 'i-heroicons-x-circle'
    case 'maintenance':
      return 'i-heroicons-wrench-screwdriver'
    default:
      return 'i-heroicons-question-mark-circle'
  }
})

const statusStyles = computed(() => {
  switch (props.status) {
    case 'operational':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        icon: 'bg-green-100 dark:bg-green-900/50 text-green-600',
        text: 'text-green-800 dark:text-green-200'
      }
    case 'degraded':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600',
        text: 'text-yellow-800 dark:text-yellow-200'
      }
    case 'partial-outage':
      return {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        icon: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600',
        text: 'text-orange-800 dark:text-orange-200'
      }
    case 'major-outage':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        icon: 'bg-red-100 dark:bg-red-900/50 text-red-600',
        text: 'text-red-800 dark:text-red-200'
      }
    case 'maintenance':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        icon: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600',
        text: 'text-blue-800 dark:text-blue-200'
      }
    default:
      return {
        bg: 'bg-gray-50 dark:bg-gray-800',
        icon: 'bg-gray-100 dark:bg-gray-700 text-gray-600',
        text: 'text-gray-800 dark:text-gray-200'
      }
  }
})

const formattedLastUpdate = computed(() => {
  if (!props.lastUpdated) return '-'
  const date = typeof props.lastUpdated === 'string' 
    ? new Date(props.lastUpdated) 
    : props.lastUpdated
  return date.toLocaleString()
})
</script>
